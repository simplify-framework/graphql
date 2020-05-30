#!/usr/bin/env node
'use strict';
const fs = require('fs')
const path = require('path')
const Hogan = require('hogan.js');
const mkdirp = require('mkdirp');
const gql = require('graphql-tag');
const { schemaParser, hoganFlatter, extendObjectValue } = require('./transformer')

function buildTemplateFile(data, tplFile) {
    const oFile = fs.readFileSync(path.resolve(__dirname, tplFile), 'utf8')
    let template = Hogan.compile(oFile);
    return template.render(data, {});
}

function writeTemplateFile(tplFile, data, outputDir, outputFile) {
    const template = Hogan.compile(JSON.stringify({ input: tplFile, output: outputFile}));
    const config = JSON.parse(template.render(data, {}));
    const dataFile = buildTemplateFile(data, config.input)
    const outputPath = path.dirname(path.join(outputDir, config.output))
    if (!fs.existsSync(outputPath)) {
        mkdirp.sync(outputPath);
    }
    fs.writeFileSync(path.join(outputDir, config.output), dataFile, 'utf8');
}

var argv = require('yargs')
    .usage('simplify-graphql (template) [options]')
    .string('input')
    .alias('i', 'input')
    .describe('input', 'Input file as graphql.schema')
    .string('output')
    .alias('o', 'output')
    .describe('output', 'Project output directory')
    .default('output', './')
    .string('project')
    .alias('p', 'project')
    .describe('project', 'Project Id')
    .string('account')
    .alias('a', 'account')
    .describe('account', 'Account Id')
    .boolean('verbose')
    .describe('verbose', 'Increase verbosity')
    .alias('v', 'verbose')
    .demandOption(['i'])
    .demandCommand(0)
    .argv;

function runCommandLine() {
    try {
        const schema = fs.readFileSync(path.resolve(path.join(argv.input)), 'utf8')
        let projectInfo = require(path.resolve(path.join(".projectInfo.json")))
        projectInfo.ProjectOutput = projectInfo.ProjectOutput || argv.output
        projectInfo.ProjectId = projectInfo.ProjectId || argv.project
        projectInfo.AccountId = projectInfo.AccountId || argv.account
        projectInfo.GeneratorVersion = require('./package.json').version
        projectInfo = extendObjectValue(projectInfo, "ProjectName", projectInfo.ProjectName)
        projectInfo = extendObjectValue(projectInfo, "DeploymentStage", projectInfo.DeploymentStage)
        const typeDefs = gql(schema);
        mainProcessor(typeDefs, schema, projectInfo)
    } catch (err) {
        console.error(`${err}`)
    }
}

function mainProcessor(typeDefs, schema, projectInfo) {
    const templatePath = require("simplify-templates")
    const templates = path.join(templatePath, "graphql")
    const config = require(path.join(templatePath, "graphql-config.json"))
    const rootObject = hoganFlatter(schemaParser(typeDefs))
    const outputDir = projectInfo.ProjectOutput || './StarWars'
    console.log("Generating Verbal GASM Design Language... (design.txt)")
    config.Deployments.map(cfg => {
        writeTemplateFile(`${templates}/${cfg.input}`, { ...rootObject, ...projectInfo }, outputDir, cfg.output)
    })
    rootObject.Servers.map(server => {
        console.log(`* GraphQL Server: ${server.Name}...`)
        config.GraphQLServers.map(cfg => {
            writeTemplateFile(`${templates}/${cfg.input}`, { ...projectInfo, ...server, serverName: server.Name, GRAPHQL_USER_DEFINITIONS: schema }, outputDir, cfg.output)
        })
        rootObject.DataObjects.map(data => {
            console.log(`   Data Object: ${data.Name}...`)
            config.GraphQLDataObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output)
            })
        })
        rootObject.EnumObjects.map(data => {
            console.log(`   Enum Object: ${data.Name}...`)
            config.GraphQLEnumObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output)
            })
        })
        rootObject.DataInputs.map(data => {
            console.log(`   Data Input: ${data.Name}...`)
            config.GraphQLDataInputs.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output)
            })
        })
        server.Definitions.map(serverDef => {
            serverDef.Paths.map(path => {
                path.Operations.map(operation => {
                    console.log(`+ Resolver: ${operation.Function.Name}...`)
                    config.GraphQLOperations.map(cfg => {
                        writeTemplateFile(`${templates}/${cfg.input}`, { ...operation.Function, DataType: operation.DataType, DataSchema: operation.DataSchema, serverName: server.Name, stateName: operation.Function.Name }, outputDir, cfg.output)
                    })
                    operation.Function.Chains && operation.Function.Chains.map(chain => {
                        if (chain.Run.Mode == "REMOTE") {
                            chain.RemoteExecutionMode = true
                        }
                        console.log(` - Function: ${chain.Run.Name}...`)
                        config.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { ...chain, serverName: server.Name, functionName: chain.Run.Name }, outputDir, cfg.output)
                        })
                    })
                    if (!operation.Function.Chains && operation.Function.Kind == "GraphQLFunction") {
                        console.log(` - Function: ${operation.Function.Name}...`)
                        config.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { serverName: server.Name, functionName: operation.Function.Name }, outputDir, cfg.output)
                        })
                    }
                })
            })
        })
    })
}

mkdirp(path.resolve(argv.output)).then(function () {
    if (argv._.length && argv._[0] === 'template') {
        console.log("╓───────────────────────────────────────────────────────────────╖")
        console.log("║               Simplify Framework  - GraphQL                   ║")
        console.log("╙───────────────────────────────────────────────────────────────╜")
        const outputSchema = path.resolve(argv.output, 'graphql.schema')
        const sampleName = path.join(__dirname, 'templates', (argv.input || 'graphql') + '.schema')
        fs.writeFileSync(outputSchema, fs.readFileSync(sampleName, 'utf8'), 'utf8')
        console.log(` - Sample graphql schema ${outputSchema}`);
        const infoName = path.join(__dirname, 'templates', '.projectInfo.json')
        const projectInfo = path.resolve(argv.output, '.projectInfo.json')
        fs.writeFileSync(projectInfo, fs.readFileSync(infoName, 'utf8'), 'utf8')
        console.log(` - Sample project config ${projectInfo}`);
        process.exit(0)
    } else {
        console.log("╓───────────────────────────────────────────────────────────────╖")
        console.log("║               Simplify Framework  - GraphQL                   ║")
        console.log("╙───────────────────────────────────────────────────────────────╜")
        console.log(` - GraphQL Project Location: ${argv.output}`);
        runCommandLine()
    }
}, function (err) {
    console.error(`${err}`)
})