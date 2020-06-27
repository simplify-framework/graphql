#!/usr/bin/env node
'use strict';
const fs = require('fs')
const path = require('path')
const jsdiff = require('diff')
const crypto = require('crypto')
const Hogan = require('hogan.js')
const mkdirp = require('mkdirp')
const gql = require('graphql-tag')
const readlineSync = require('readline-sync');
const CBEGIN = '\x1b[32m'
const CERROR = '\x1b[31m'
const CRESET = '\x1b[0m'
const CPROMPT = '\x1b[33m'

const { schemaParser, hoganFlatter, extendObjectValue } = require('./transformer');
const transformer = require('./transformer');

function creatFileOrPatch(filePath, newFileData, encoding, config) {
    try {
        const inputFileName = path.basename(config.input)
        if (fs.existsSync(filePath)) {            
            let ignoreOverridenFiles = [
                ".env.mustache",
                ".babelrc.mustache",
                ".gitignore.mustache",
                "package-src.mustache",
                "function.mustache",
                "server-input.mustache",
                "function-input.mustache",
                "index-src.mustache",
                "webpack.config.mustache",
                "webpack.config.layer.mustache",
                "docker-entrypoint.mustache",
                "Dockerfile.mustache",
                "README.mustache"
            ]            
            if (config.ignores) {
                config.ignores.split(';').forEach(function(ignore) {
                    const parts = ignore.split('.')
                    const ignoredFile = parts.splice(0, parts.length - 1).join('.') + '.mustache'
                    ignoreOverridenFiles.push(ignoredFile)
                })
            }
            if (ignoreOverridenFiles.indexOf(inputFileName)>=0) {
                if (!config.override) {
                    console.log(`   * ${CPROMPT}ignore${CRESET}`, filePath)
                    return undefined
                } else {
                    console.log(`   * ${CPROMPT}update${CRESET}`, filePath)
                }
            } else {
                console.log(`   * ${CPROMPT}update${CRESET}`, filePath)
            }
            var oldFile = fs.readFileSync(filePath).toString()
            function addNewLine(value, lastRemoved) {
                return lastRemoved ? `${value}>>>>>>> auto:${filePath}\n` : value
            }
            function removeYourLine(value, lastRemoved) {
                var newline = `<<<<<<< mine:${filePath}\n${value}=======\n`
                if (lastRemoved) newline += `>>>>>>> auto:${filePath}\n`
                return newline
            }
            if (config.merge) {
                var diff = jsdiff.diffLines(oldFile.toString(), newFileData, { newlineIsToken: false, ignoreWhitespace: false })
                var lastAdded = false
                var lastRemoved = false
                var index = 0
                var content = diff.map(function (part) {
                    if (++index == (diff.length -1) && part.removed) { lastRemoved = true }
                    var newcontent = part.removed ? removeYourLine(part.value, index == (diff.length -1)) : (part.added ? addNewLine(part.value, lastRemoved): part.value)
                    if (part.added) { lastAdded = true; lastRemoved = false;  }
                    if (part.removed) { lastAdded = false; lastRemoved = true; }
                    return newcontent
                }).join('');
                fs.writeFileSync(filePath, content, encoding);
                var patcheL = jsdiff.createPatch(`${filePath}`, oldFile.toString(), newFileData);
                if (jsdiff.parsePatch(patcheL)[0].hunks.length) {
                    console.log(` * ${CERROR}Require Review${CRESET} *: ${filePath}`)
                }
            } else {
                fs.writeFileSync(filePath, newFileData, encoding);
            }
            if (config.diff) {
                var patcheL = jsdiff.createPatch(`${filePath}`, oldFile.toString(), newFileData);
                if (jsdiff.parsePatch(patcheL)[0].hunks.length) {
                    fs.writeFileSync(`${filePath}.diff`, patcheL, encoding);
                }
            }
        } else {
            console.log(`   * ${CPROMPT}create${CRESET}`, filePath)
            fs.writeFileSync(filePath, newFileData, encoding);
        }
    }
    catch (_) {
        fs.writeFileSync(filePath, newFileData, encoding);
    }
}

function buildTemplateFile(data, tplFile) {
    const oFile = fs.readFileSync(path.resolve(__dirname, tplFile), 'utf8')
    let template = Hogan.compile(oFile);
    return template.render(data, {});
}

function writeTemplateFile(tplFile, data, outputDir, outputFile, writeConfig) {
    const template = Hogan.compile(JSON.stringify({ input: tplFile, output: outputFile}));
    const config = JSON.parse(template.render(data, {}));
    const dataFile = buildTemplateFile(data, config.input)
    const outputPath = path.dirname(path.join(outputDir, config.output))
    if (!fs.existsSync(outputPath)) {
        mkdirp.sync(outputPath);
    }
    creatFileOrPatch(path.join(outputDir, config.output), dataFile, 'utf8', { ...writeConfig, input: path.basename(tplFile) })
}

var argv = require('yargs')
    .usage('simplify-graphql (template) [options]')
    .string('input')
    .alias('i', 'input')
    .describe('input', 'Input file as graphql.schema')
    .default('input', 'schema.graphql')
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
    .string('env')
    .alias('e', 'env')
    .describe('env', 'Environment')
    .boolean('merge')
    .describe('merge', 'Auto merge files')
    .boolean('diff')
    .describe('diff', 'Generate diff file')
    .string('ignores')
    .alias('n', 'ignores')
    .describe('ignores', 'eg: keep-your-code.js;keep-your-data.json')
    .string('override')
    .boolean('verbose')
    .describe('verbose', 'Increase verbosity')
    .alias('v', 'verbose')
    .demandCommand(0)
    .argv;

function runCommandLine() {
    try {
        const config = { writes: {} }
        const projectInfoPath = path.resolve(path.join(".projectInfo.json"))
        let schemaInputFile = path.resolve(path.join(argv.input))
        let projectInfo = {}
        if (fs.existsSync(projectInfoPath)) {
            projectInfo = require(projectInfoPath)
        }
        if (!fs.existsSync(schemaInputFile)) {
            console.log(` * ${CPROMPT}GraphQL Schema '${argv.input}' is not found.${CRESET}`)
            if (readlineSync.keyInYN(` - ${CPROMPT}Do you want to generate a schema sample?${CRESET} `)) {
                const outputSchema = path.resolve(argv.output, argv.input || 'schema.graphql')
                const sampleName = path.join(__dirname, 'templates', 'schema.graphql')
                fs.writeFileSync(outputSchema, fs.readFileSync(sampleName, 'utf8'), 'utf8')
                schemaInputFile = path.resolve(path.join(argv.input))
                if (!fs.existsSync(schemaInputFile)) {
                    process.exit(-1)
                }
            } else {
                console.log(` ! ${CERROR}A GraphQL schema is required to generate code.${CRESET}`)
                process.exit(-1)
            }
        }
        projectInfo.ProjectVersion = projectInfo.ProjectVersion || "0.1.0"
        projectInfo.ProjectId = argv.project || projectInfo.ProjectId
        projectInfo.DeploymentEnv = argv.env || projectInfo.DeploymentEnv
        projectInfo.DeploymentAccount = argv.account || projectInfo.DeploymentAccount
        if (!projectInfo.ProjectName) {
            projectInfo.ProjectName = readlineSync.question(` - ${CPROMPT}What is your Project name?${CRESET} `)
            if (!projectInfo.ProjectName) {
                console.log(` ! ${CERROR}Project name is required to generate your infrastructure.${CRESET}`)
                process.exit(-1)
            }
        }
        if (!projectInfo.ProjectDesc) {
            projectInfo.ProjectDesc = readlineSync.question(` - ${CPROMPT}What is your Project description?${CRESET} `)
            if (!projectInfo.ProjectDesc) {
                console.log(` ! ${CERROR}Project description is required to use as package description.${CRESET}`)
                process.exit(-1)
            }
        }
        if (!projectInfo.ProjectId) {
            const randomValue = crypto.randomBytes(8).toString("hex")
            projectInfo.ProjectId = readlineSync.question(` - ${CPROMPT}What is your Project Id?${CRESET} (${randomValue}): `)
            projectInfo.ProjectId = projectInfo.ProjectId || randomValue
        }
        if (!projectInfo.DeploymentEnv) {
            projectInfo.DeploymentEnv = readlineSync.question(` - ${CPROMPT}Create your Deployment Environment?${CRESET} (*demo|devel|staging): `)
            projectInfo.DeploymentEnv = projectInfo.DeploymentEnv || 'demo'
        }
        if (!projectInfo.DeploymentBucket) {
            projectInfo.DeploymentBucket = readlineSync.question(` - ${CPROMPT}Choose your Deployment Bucket?${CRESET} (starwars-deployment-eu-west-1): `)
            projectInfo.DeploymentBucket = projectInfo.DeploymentBucket || 'starwars-deployment-eu-west-1'
        }
        if (!projectInfo.DeploymentRegion) {
            projectInfo.DeploymentRegion = readlineSync.question(` - ${CPROMPT}Choose your Deployment Region?${CRESET} (eu-west-1): `)
            projectInfo.DeploymentRegion = projectInfo.DeploymentRegion || 'eu-west-1'
        }
        if (!projectInfo.DeploymentProfile) {
            projectInfo.DeploymentProfile = readlineSync.question(` - ${CPROMPT}Create new Deployment Profile?${CRESET} (simplify-eu): `)
            projectInfo.DeploymentProfile = projectInfo.DeploymentProfile || 'simplify-eu'
        }
        if (!projectInfo.DeploymentAccount) {
            projectInfo.DeploymentAccount = readlineSync.question(` - ${CPROMPT}What is your AWS Account Id?${CRESET} `)
            if (!projectInfo.DeploymentAccount) {
                console.log(` ! ${CERROR}AWS Account Id is required to provision your code with a right permission.${CRESET}`)
                process.exit(-1)
            }
        }
        if (!projectInfo.DeploymentApiKey) {
            const randomValue = crypto.randomBytes(20).toString("hex")
            projectInfo.DeploymentApiKey = readlineSync.question(` - ${CPROMPT}What is your Endpoint ApiKey?${CRESET} (${randomValue}): `)
            projectInfo.DeploymentApiKey = projectInfo.DeploymentApiKey || randomValue
        }
        fs.writeFileSync(projectInfoPath, JSON.stringify(projectInfo, null, 2), 'utf8');
        const schema = fs.readFileSync(schemaInputFile, 'utf8')
        projectInfo.ProjectOutput = projectInfo.ProjectOutput || argv.output
        projectInfo.GeneratorVersion = require('./package.json').version
        projectInfo = extendObjectValue(projectInfo, "ProjectName", projectInfo.ProjectName)
        projectInfo = extendObjectValue(projectInfo, "DeploymentEnv", projectInfo.DeploymentEnv)
        if (typeof argv.diff !== 'undefined') {
            config.writes.diff = true;
        }
        if (typeof argv.merge !== 'undefined') {
            config.writes.merge = true;
        }
        if (typeof argv.ignores !== 'undefined') {
            config.writes.ignores = true;
        }
        if (typeof argv.override !== 'undefined') {
            config.writes.override = true;
        }
        if (typeof argv.verbose !== 'undefined') {
            argv.verbose = true;
        }
        projectInfo.WriteConfig = config.writes
        const typeDefs = gql(schema);
        mainProcessor(typeDefs, schema, projectInfo)
        return { err: undefined, projectInfo }
    } catch (err) {
        console.error(`${err}`)
        return { err }
    }
}

function parseDefaultObjectValue(rootObject, vObj) {
    if (vObj.Value.isObjectType || vObj.Value.isListObjectType) {
        let newValue = rootObject.DataObjects.find(obj => obj.Name == vObj.Value.Value)
        if (!newValue) newValue = rootObject.DataInputs.find(obj => obj.Name == vObj.Value.Value)
        if (!newValue) newValue = rootObject.EnumObjects.find(obj => obj.Name == vObj.Value.Value)
        if (newValue.Type === "EnumObject") {
            vObj.Value.Default = newValue.Value[0].Value
            vObj.Value.isEnumObject = true
        } else {
            vObj.Value.Default = Object.keys(newValue.Value).map(k => {
                let obj = {}
                if (!newValue.Value[k].isObjectType) {
                    if (typeof newValue.Value[k] === "object" && newValue.Value[k].Value.Name) {
                        if (newValue.Value[k].Value) {
                            obj = parseDefaultObjectValue(rootObject, newValue.Value[k])
                        }
                        obj[newValue.Value[k].Name] = newValue.Value[k].Value.Default || newValue.Value[k].Value
                        return obj
                    }
                    return newValue.Value[k]
                }
            }).filter(obj => obj)
            let objResult = {}
            Object.keys(vObj.Value.Default).map(kobj => {
                objResult[vObj.Value.Default[kobj].Name] = vObj.Value.Default[kobj].Value.Default
            })
            vObj.Value.Default = JSON.stringify(objResult)
            vObj.Value.isJSONObject = true
        }
    }
    return vObj
}

function mainProcessor(typeDefs, schema, projectInfo) {
    const templatePath = require("simplify-templates")
    const templates = path.join(templatePath, "graphql")
    const gqlConfig = require(path.join(templatePath, "config-graphql.json"))
    const rootObject = hoganFlatter(schemaParser(typeDefs))
    const outputDir = projectInfo.ProjectOutput || './StarWars'
    argv.verbose && console.log("Generating Verbal GASM Design Language... (design.txt)")
    gqlConfig.Deployments.map(cfg => {
        writeTemplateFile(`${templates}/${cfg.input}`, { ...rootObject, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
    })
    rootObject.Servers.map(server => {
        argv.verbose && console.log(`* GraphQL Server: ${server.Name}...`)
        gqlConfig.GraphQLServers.map(cfg => {
            writeTemplateFile(`${templates}/${cfg.input}`, { ...projectInfo, ...server, serverName: server.Name, GRAPHQL_USER_DEFINITIONS: schema }, outputDir, cfg.output, projectInfo.WriteConfig)
        })
        rootObject.DataObjects.map(data => {
            argv.verbose && console.log(`   Data Object: ${data.Name}...`)
            gqlConfig.GraphQLDataObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        rootObject.EnumObjects.map(data => {
            argv.verbose && console.log(`   Enum Object: ${data.Name}...`)
            gqlConfig.GraphQLEnumObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        rootObject.DataInputs.map(data => {
            argv.verbose && console.log(`   Data Input: ${data.Name}...`)
            gqlConfig.GraphQLDataInputs.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, serverName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        rootObject.Functions.map(func => {
            argv.verbose && console.log(`   Remote Function: ${func.FunctionName}...`)
            const dataObject = rootObject.DataObjects.find(obj => obj.Name ==func.DataSchema)
            dataObject.Value.map(v => {
                return parseDefaultObjectValue(rootObject, v)
            }).filter(obj => obj)
            gqlConfig.RemoteFunctions.map(cfg => {
                writeTemplateFile(`${templates}/${cfg.input}`, { ...func, serverName: server.Name, functionName: func.FunctionName, functionNameSnake: func.FunctionNameSnake, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        server.Definitions.map(serverDef => {
            serverDef.Paths.map(path => {
                path.Resolvers.map(resolver => {
                    argv.verbose && console.log(`+ Resolver: ${resolver.Resolver.Name}...`)
                    gqlConfig.GraphQLResolvers.map(cfg => {
                        writeTemplateFile(`${templates}/${cfg.input}`, { ...resolver.Resolver, DataType: resolver.DataType, DataSchema: resolver.DataSchema, serverName: server.Name, stateName: resolver.Resolver.Name,...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
                    })
                    const dataObject = rootObject.DataObjects.find(obj => obj.Name ==resolver.DataSchema)
                    dataObject.Value.map(v => {
                        return parseDefaultObjectValue(rootObject, v)
                    }).filter(obj => obj)
                    resolver.Resolver.Chains && resolver.Resolver.Chains.map(chain => {
                        argv.verbose && console.log(` - Function: ${chain.Run.Name}...`)
                        gqlConfig.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { ...chain, serverName: server.Name, functionName: chain.Run.Name, serverName: server.Name, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
                        })
                    })
                    if (!resolver.Resolver.Chains && resolver.Resolver.Kind == "GraphQLResolver") {
                        argv.verbose && console.log(` - Function: ${resolver.Resolver.Name}...`)
                        console.log(dataObject.Value)
                        gqlConfig.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { serverName: server.Name, functionName: resolver.Resolver.Name, serverName: server.Name, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
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
        const outputSchema = path.resolve(argv.output, 'schema.graphql')
        const sampleName = path.join(__dirname, 'templates', (argv.input || 'schema') + '.graphql')
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
        console.log(` - Automatic code merge is ${argv.merge ? 'on (remove option --merge to turn off)' : 'off (use option --merge to turn on)'}`)
        console.log(` - Diff file generation is ${argv.diff ? 'on (remove option --diff to turn off)' : 'off (use option --diff to turn on)'}`)
        console.log(` - Override custom code is ${argv.override ? 'on (remove option --override to turn off)' : 'off (use option --override to turn on)'}`)
        const { err, projectInfo } = runCommandLine()
        console.log(` - Finish code generation ${!err ? `with NO error. See ${argv.output=="./"?"current folder":argv.output} for your code!` : err}`);
        if (!err && projectInfo) {
            console.log(`\n * Follow these commands to walk throught your project: (${projectInfo.ProjectName})\n`)
            console.log(` 1. Setup AWS Account\t: ${CBEGIN}bash .simplify-graphql/setup.sh --profile MASTER ${CRESET}`)
            console.log(` 2. Goto Project Dir\t: ${CBEGIN}cd ${argv.output} ${CRESET}`)
            console.log(` 3. Install Packages\t: ${CBEGIN}npm install ${CRESET}`)
            console.log(` 4. Deploy AWS Stacks\t: ${CBEGIN}npm run stack-deploy ${CRESET}`)
            console.log(` 5. Push Code Functions\t: ${CBEGIN}npm run push-code ${CRESET}`)
            console.log(` 6. Update Environments\t: ${CBEGIN}npm run push-update ${CRESET}`)
            console.log(` 7. Monitor Metrics\t: ${CBEGIN}npm run monitor-metric ${CRESET}`)
            console.log(` 8. Destroy AWS Stacks\t: ${CBEGIN}npm run stack-destroy ${CRESET}`)
            console.log(` 9. Cleanup AWS Account\t: ${CBEGIN}bash .simplify-graphql/cleanup.sh --profile MASTER ${CRESET}\n`)
            console.log(`\n * Create or switch environment with option --env=ENVIRONMENT_NAME\n`);
        }
    }
}, function (err) {
    console.error(`${err}`)
})
