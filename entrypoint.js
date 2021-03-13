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

const { schemaParser, hoganFlatter, extendObjectValue, convertToArrayWithNotation } = require('./transformer');
const transformer = require('./transformer');

function creatFileOrPatch(filePath, newFileData, encoding, config) {
    try {
        const inputFileName = path.basename(config.input)
        if (fs.existsSync(filePath)) {
            let ignoreOverridenFiles = [
                ".babelrc.mustache",
                ".gitignore.mustache",
                "package-src.mustache",
                "function.mustache",
                "server-input.mustache",
                "function-input.mustache",
                "index-src.mustache",
                "tests.spec.mustache"
            ]
            if (config.ignores) {
                config.ignores.split(';').forEach(function (ignore) {
                    const parts = ignore.split('.')
                    const ignoredFile = parts.splice(0, parts.length - 1).join('.') + '.mustache'
                    ignoreOverridenFiles.push(ignoredFile)
                })
            }
            if (ignoreOverridenFiles.indexOf(inputFileName) >= 0) {
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
                    if (++index == (diff.length - 1) && part.removed) { lastRemoved = true }
                    var newcontent = part.removed ? removeYourLine(part.value, index == (diff.length - 1)) : (part.added ? addNewLine(part.value, lastRemoved) : part.value)
                    if (part.added) { lastAdded = true; lastRemoved = false; }
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
    const template = Hogan.compile(JSON.stringify({ input: tplFile, output: outputFile }));
    const config = JSON.parse(template.render(data, {}));
    let dataFile = buildTemplateFile(data, config.input)
    if (!argv.simple) {
        const templateFilePath = path.resolve(".template", config.output)
        if (fs.existsSync(templateFilePath)) {
            dataFile = buildTemplateFile(data, templateFilePath)
            const templateEnvFilePath = path.resolve(".template", `${config.output}.${writeConfig.env}`)
            if (fs.existsSync(templateEnvFilePath)) {
                dataFile = buildTemplateFile(data, templateEnvFilePath)
            }
        } else {
            const templateEnvFilePath = path.resolve(".template", `${config.output}.${writeConfig.env}`)
            if (fs.existsSync(templateEnvFilePath)) {
                dataFile = buildTemplateFile(data, templateEnvFilePath)
            } else {
                const templatePath = path.dirname(path.resolve(templateFilePath))
                if (!fs.existsSync(templatePath)) {
                    mkdirp.sync(templatePath);
                }
            }
        }
    }
    const outputPath = path.dirname(path.join(outputDir, config.output))
    if (!fs.existsSync(outputPath)) {
        mkdirp.sync(outputPath);
    }
    creatFileOrPatch(path.join(outputDir, config.output), dataFile, 'utf8', { ...writeConfig, input: path.basename(tplFile) })
}

function projectFlatter(projectInfo, envName) {
    let projectResult = {}
    if (projectInfo.ProjectName && projectInfo.DeploymentEnv && projectInfo.DeploymentEnv === envName) {
        projectInfo = projectConvert(projectInfo)
    }
    if (projectInfo && projectInfo.Project) {
        Object.keys(projectInfo.Project).map(k => {
            projectResult[`PROJECT_${k}`] = projectInfo.Project[k]
        })
    }
    if (projectInfo && projectInfo.Environment) {
        projectResult[`ENV_Name`] = envName
        const environmentConfig = projectInfo.Environment.Config[projectResult[`ENV_Name`]]
        environmentConfig && Object.keys(environmentConfig).map(k => {
            projectResult[`ENV_${k}`] = environmentConfig[k]
        })
    }
    return projectResult
}

function projectConvert(projectInfo) {
    let projectResult = { Project: {}, Environment: { Config: {} } }
    projectResult.Environment.Active = projectInfo.DeploymentEnv
    projectResult.Environment.Config[projectInfo.DeploymentEnv] = {}
    if (projectInfo) {
        Object.keys(projectInfo).map(k => {
            if (k.startsWith('Project')) {
                projectResult.Project[k.replace('Project', '')] = projectInfo[k]
            } else if (k.startsWith('Deployment')) {
                projectResult.Environment.Config[projectInfo.DeploymentEnv][k.replace('Deployment', '')] = projectInfo[k]
            }
        })
    }
    return projectResult
}

function projectUpdate(projectOriginInfo, projectInfo) {
    let projectResult = {
        Project: {}, 
        Environment: { 
            Active: projectInfo.ENV_Name,
            Config: (projectOriginInfo.Environment || { Config: {}}).Config || {}
        } 
    }
    projectResult.Environment.Config[projectInfo.ENV_Name] = {}
    if (projectInfo) {
        Object.keys(projectInfo).map(k => {
            if (k.startsWith('PROJECT_')) {
                projectResult.Project[k.replace('PROJECT_', '')] = projectInfo[k]
            } else if (k.startsWith('ENV_')) {
                const config = projectResult.Environment.Config[projectInfo['ENV_Name']]
                config[k.replace('ENV_', '')] = projectInfo[k]
            }
        })
    }
    return projectResult
}

function projectSwitchEnv(projectOriginInfo, projectInfo, projectInfoPath) {
    projectInfo.PROJECT_Version = projectInfo.PROJECT_Version || "0.1.0"
    projectInfo.PROJECT_Id = argv.project || projectInfo.ENV_ProjectId || projectInfo.PROJECT_Id
    projectInfo.ENV_AccountId = argv.account || projectInfo.ENV_AccountId
    if (!projectInfo.PROJECT_Name && !argv.simple) {
        projectInfo.PROJECT_Name = readlineSync.question(` - ${CPROMPT}What is your Project name?${CRESET} `)
        if (!projectInfo.PROJECT_Name && !argv.simple) {
            console.log(` ! ${CERROR}Project name is required to generate your infrastructure.${CRESET}`)
            process.exit(-1)
        }
    }
    if (!projectInfo.PROJECT_DomainName && !argv.simple) {
        projectInfo.PROJECT_DomainName = readlineSync.question(` - ${CPROMPT}What is your Domain name?${CRESET} (${projectInfo.PROJECT_Name.toLowerCase()}.com): `)
        projectInfo.PROJECT_DomainName = projectInfo.PROJECT_DomainName || `${projectInfo.PROJECT_Name.toLowerCase()}.com`
    }
    if (!projectInfo.PROJECT_Desc && !argv.simple) {
        projectInfo.PROJECT_Desc = readlineSync.question(` - ${CPROMPT}What is your Project description?${CRESET} `)
        if (!projectInfo.PROJECT_Desc) {
            console.log(` ! ${CERROR}Project description is required to use as package description.${CRESET}`)
            process.exit(-1)
        }
    }
    if (!projectInfo.PROJECT_Id && !argv.simple) {
        const randomValue = crypto.randomBytes(8).toString("hex")
        projectInfo.PROJECT_Id = readlineSync.question(` - ${CPROMPT}What is your Project Id?${CRESET} (${randomValue}): `)
        projectInfo.PROJECT_Id = projectInfo.PROJECT_Id || randomValue
    }
    if (!projectInfo.PROJECT_Profile) {
        projectInfo.PROJECT_Profile = readlineSync.question(` - ${CPROMPT}What is your AWS Provisioning Profile?${CRESET} (default): `)
        projectInfo.PROJECT_Profile = projectInfo.PROJECT_Profile || 'default'
    }
    if (!projectInfo.ENV_Name && !argv.simple) {
        projectInfo.ENV_Name = readlineSync.question(` - ${CPROMPT}Create your Deployment Environment?${CRESET} (*demo|devel|staging): `)
        projectInfo.ENV_Name = projectInfo.ENV_Name || 'demo'
    }
    if (!projectInfo.ENV_Bucket && !argv.simple) {
        projectInfo.ENV_Bucket = readlineSync.question(` - ${CPROMPT}Choose your Deployment Bucket?${CRESET} (starwars-deployment-eu-west-1): `)
        projectInfo.ENV_Bucket = projectInfo.ENV_Bucket || 'starwars-deployment-eu-west-1'
    }
    if (!projectInfo.ENV_Region && !argv.simple) {
        projectInfo.ENV_Region = readlineSync.question(` - ${CPROMPT}Choose your Deployment Region?${CRESET} (eu-west-1): `)
        projectInfo.ENV_Region = projectInfo.ENV_Region || 'eu-west-1'
    }
    if (!projectInfo.ENV_Profile && !argv.simple) {
        projectInfo.ENV_Profile = readlineSync.question(` - ${CPROMPT}Create new Deployment Profile?${CRESET} (starwars-eu): `)
        projectInfo.ENV_Profile = projectInfo.ENV_Profile || 'simplify-eu'
    }
    if (!projectInfo.ENV_AccountId && !argv.simple) {
        projectInfo.ENV_AccountId = readlineSync.question(` - ${CPROMPT}What is your AWS Account Id?${CRESET} `)
        if (!projectInfo.ENV_AccountId) {
            console.log(` ! ${CERROR}AWS Account Id is required to provision your code with a right permission.${CRESET}`)
            process.exit(-1)
        }
    }
    if (!projectInfo.ENV_ApiKey && !argv.simple) {
        const randomValue = crypto.randomBytes(20).toString("hex")
        projectInfo.ENV_ApiKey = readlineSync.question(` - ${CPROMPT}What is your Endpoint ApiKey?${CRESET} (${randomValue}): `)
        projectInfo.ENV_ApiKey = projectInfo.ENV_ApiKey || randomValue
    }
    if (!projectInfo.ENV_AuthorizerId && !argv.simple) {
        if (readlineSync.keyInYN(` - ${CPROMPT}Do you want to enable Cognito UserPool authorizer?${CRESET} `)) {
            projectInfo.ENV_AuthorizerId = readlineSync.question(` - ${CPROMPT}What is your Cognito UserPool Id?${CRESET} (${projectInfo.ENV_Region}_xxxxxx): `)
            projectInfo.ENV_AuthorizerId = projectInfo.ENV_AuthorizerId || "NO"
        } else {
            projectInfo.ENV_AuthorizerId = "NO"
        }
    }
    projectInfo.hasAuthorizerId = projectInfo.ENV_AuthorizerId !== "NO" ? true: false
    projectOriginInfo = projectUpdate(projectOriginInfo, projectInfo)
    fs.writeFileSync(projectInfoPath, JSON.stringify(projectOriginInfo, null, 2), 'utf8');
    return projectInfo
}

const yargs = require('yargs')

yargs.usage('simplify-graphql [template] [options]')
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
    .string('env')
    .alias('e', 'env')
    .describe('env', 'Environment')
    .string('mode')
    .describe('mode', 'Generate singleton|multiple code base')
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

const argv = yargs.argv;
if (argv._.length === 0 && !argv.input) {
    yargs.showHelp()
    process.exit(1)
}

function runCommandLine() {
    try {
        const config = { writes: {} }
        const projectInfoPath = path.resolve(path.join(".projectInfo.json"))
        let schemaInputFile = path.resolve(path.join(argv.input))
        let projectInfo = {}
        let projectOriginInfo = require(projectInfoPath)
        if (fs.existsSync(projectInfoPath)) {
            projectInfo = projectFlatter(projectOriginInfo, argv.env || 'demo')
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
        projectInfo = projectSwitchEnv(projectOriginInfo, projectInfo, projectInfoPath)
        const schema = fs.readFileSync(schemaInputFile, 'utf8')
        projectInfo.ProjectOutput = projectInfo.ProjectOutput || argv.output
        projectInfo.GeneratorVersion = require('./package.json').version
        projectInfo = extendObjectValue(projectInfo, "PROJECT_Name", projectInfo.PROJECT_Name)
        projectInfo = extendObjectValue(projectInfo, "ENV_Name", projectInfo.ENV_Name)
        if (typeof argv.diff !== 'undefined') {
            config.writes.diff = true;
        }
        if (typeof argv.merge !== 'undefined') {
            config.writes.merge = true;
        }
        if (typeof argv.ignores !== 'undefined') {
            config.writes.ignores = argv.ignores;
        }
        if (typeof argv.override !== 'undefined') {
            config.writes.override = true;
        }
        if (typeof argv.verbose !== 'undefined') {
            argv.verbose = true;
        }
        if (typeof argv.simple !== 'undefined') {
            argv.simple = true;
        }
        projectInfo.WriteConfig = { ...config.writes, env: projectInfo.ENV_Name }
        const typeDefs = gql(schema);
        mainProcessor(typeDefs, schema, projectInfo)
        return { err: undefined, projectInfo }
    } catch (err) {
        console.error(`${err}`, err)
        return { err }
    }
}

function parseDefaultObjectValue(rootObject, vObj) {
    if (vObj.Value.isObjectType || vObj.Value.isListObjectType) {
        let newValue = rootObject.DataObjects.find(obj => obj.Name == vObj.Value.Value)
        if (!newValue) newValue = rootObject.DataInputs.find(obj => obj.Name == vObj.Value.Value)
        if (!newValue) newValue = rootObject.EnumObjects.find(obj => obj.Name == vObj.Value.Value)
        if (!newValue) {
            throw { message: 'Cannot find any definition of this object in schema.', object: vObj }
        } else if (newValue.Type === "EnumObject") {
            vObj.Value.Default = newValue.Value[0].Value
            vObj.Value.isEnumObject = true
            vObj.Value.isQuotedType = true
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
            vObj.Value.isNestedObject = true
        }
    }
    return vObj
}

function mainProcessor(typeDefs, schema, projectInfo) {
    const templatePath = require("simplify-templates")
    const templates = path.join(templatePath, "graphql")
    const gqlConfig = require(path.join(templatePath, argv.mode == "singleton" ? "config-graphql-singleton.json" : "config-graphql.json"))
    const rootObject = hoganFlatter(schemaParser(typeDefs), argv.mode == "singleton")
    const outputDir = projectInfo.ProjectOutput || '.'
    argv.verbose && console.log("Generating Verbal GASM Design Language... (design.txt)")
    rootObject.DataTables = []
    rootObject.DataSources.map(ds => {
        if (ds.isDynamoDB) {
            const mergedTables = [...rootObject.DataTables, ...ds.Tables]
            rootObject.DataTables = mergedTables.sort((a, b) => a.Name < b.Name ? 1 : -1).filter((item, pos, ary) => {
                item.isReadWrite = typeof item.Access === 'undefined' ? false : item.Access === "READ_WRITE"
                item.isReadOnly = typeof item.Access === 'undefined' ? true : item.Access === "READ_ONLY"
                return (!pos || item.Name != ary[pos - 1].Name)
            })
            rootObject.DataTables.isDynamoDB = ds.isDynamoDB
        }
    })
    rootObject.DataTables = transformer.convertToArrayWithNotation(rootObject.DataTables)
    gqlConfig.Deployments.map(cfg => {
        writeTemplateFile(`${templates}/${cfg.input}`, { ...rootObject, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
    })
    rootObject.Servers.map(server => {
        argv.verbose && console.log(`* GraphQL Server: ${server.Name}...`)
        let dataSources = rootObject.DataSources.filter(ds => ds.Definition.includes(server.Definition))
        dataSources = transformer.convertToArrayWithNotation(dataSources)
        let serverFunctions = []
        !rootObject.Functions.isEmpty && rootObject.Functions.map(f => {
            if (f.Servers.find(s => {
                return s.ServerName == server.Name
            })) {
                serverFunctions.push(f)
            }
        })
        serverFunctions = transformer.convertToArrayWithNotation(serverFunctions)
        gqlConfig.GraphQLServers.map(cfg => {
            writeTemplateFile(`${templates}/${cfg.input}`, { ...projectInfo, ...server, ServerName: server.Name, Functions: serverFunctions, DataSources: dataSources, GRAPHQL_USER_DEFINITIONS: schema }, outputDir, cfg.output, projectInfo.WriteConfig)
        })
        rootObject.DataObjects.map(data => {
            argv.verbose && console.log(`   Data Object: ${data.Name}...`)
            gqlConfig.GraphQLDataObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, ServerName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        rootObject.EnumObjects.map(data => {
            argv.verbose && console.log(`   Enum Object: ${data.Name}...`)
            gqlConfig.GraphQLEnumObjects.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, ServerName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        rootObject.DataInputs.map(data => {
            argv.verbose && console.log(`   Data Input: ${data.Name}...`)
            gqlConfig.GraphQLDataInputs.map(cfg => {
                if (data.UserType) writeTemplateFile(`${templates}/${cfg.input}`, { ...data, ServerName: server.Name, dataName: data.Name }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        !rootObject.Functions.isEmpty && rootObject.Functions.map(func => {
            argv.verbose && console.log(`   Remote Function: ${func.FunctionName}...`)
            const dataObject = rootObject.DataObjects.find(obj => obj.Name == func.DataSchema)
            dataObject.Value.map(v => {
                return parseDefaultObjectValue(rootObject, v)
            }).filter(obj => obj)
            dataObject.Value = transformer.convertToArrayWithNotation(dataObject.Value)
            func = extendObjectValue(func, "Name", func.Name)
            gqlConfig.Executions.map(cfg => {
                writeTemplateFile(`${templates}/${cfg.input}`, { ...func, ServerName: server.Name, FunctionName: func.FunctionName, FunctionNameSnake: func.FunctionNameSnake, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
            })
        })
        server.Definitions.map(serverDef => {
            serverDef.Paths.map(path => {
                path.Resolvers.map(resolver => {
                    resolver.isResultListType = resolver.DataType == "ListType"
                    const dataObject = rootObject.DataObjects.find(obj => obj.Name == resolver.DataSchema)
                    dataObject.Value.map(v => {
                        return parseDefaultObjectValue(rootObject, v)
                    }).filter(obj => obj)
                    argv.verbose && console.log(`+ Resolver: ${resolver.Resolver.Name}...`)
                    gqlConfig.GraphQLResolvers.map(cfg => {
                        let dataModel = { Definition: serverDef.Definition, Path: path.Path, ...resolver, ...resolver.Resolver, ServerName: server.Name, StateName: resolver.Resolver.Name, DataValues: dataObject.Value, ...projectInfo }
                        dataModel = extendObjectValue(dataModel, "Definition", dataModel.Definition)
                        dataModel = extendObjectValue(dataModel, "ServerName", dataModel.ServerName)
                        writeTemplateFile(`${templates}/${cfg.input}`, dataModel, outputDir, cfg.output, projectInfo.WriteConfig)
                    })
                    dataObject.Value = transformer.convertToArrayWithNotation(dataObject.Value)
                    resolver.Resolver.Chains && resolver.Resolver.Chains.map(chain => {
                        argv.verbose && console.log(` - Function: ${chain.Run.Name}...`)
                        gqlConfig.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { ...chain, ServerName: server.Name, FunctionName: chain.Run.Name, ServerName: server.Name, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
                        })
                    })
                    if (!resolver.Resolver.Chains && resolver.Resolver.Kind == "GraphQLResolver") {
                        argv.verbose && console.log(` - Function: ${resolver.Resolver.Name}...`)
                        gqlConfig.GraphQLFunctions.map(cfg => {
                            writeTemplateFile(`${templates}/${cfg.input}`, { ...resolver, ServerName: server.Name, FunctionName: resolver.Resolver.Name, ServerName: server.Name, DataValues: dataObject.Value, ...projectInfo }, outputDir, cfg.output, projectInfo.WriteConfig)
                        })
                    }
                })
            })
        })
    })
}

const showBanner = function() {
    console.log("╓───────────────────────────────────────────────────────────────╖")
    console.log(`║              Simplify Framework  - GraphQL (${require('./package.json').version})           ║`)
    console.log("╙───────────────────────────────────────────────────────────────╜\n")
}

mkdirp(path.resolve(argv.output)).then(function () {
    if (argv._.length && argv._[0] === 'template') {
        showBanner()
        const outputSchema = path.resolve(argv.output, 'schema.graphql')
        const sampleName = path.join(__dirname, 'templates', (argv.input || 'schema') + '.graphql')
        fs.writeFileSync(outputSchema, fs.readFileSync(sampleName, 'utf8'), 'utf8')
        console.log(` - Sample graphql schema ${outputSchema}`);
        const infoName = path.join(__dirname, 'templates', '.projectInfo.json')
        const projectInfo = path.resolve(argv.output, '.projectInfo.json')
        fs.writeFileSync(projectInfo, argv.simple ? JSON.stringify({ ProjectType: "GraphQL/ApolloServer", CreatedDate: new Date().toISOString() }, null, 4) : fs.readFileSync(infoName, 'utf8'), 'utf8')
        console.log(` - Sample project config ${projectInfo}`);
        process.exit(0)
    } else {
        const { err, projectInfo } = runCommandLine()
        console.log(` - Finish code generation ${!err ? `with NO error. See ${argv.output == "./" ? "current folder" : argv.output} for your code!` : err}`);
        if (!err && projectInfo && !argv.simple) {
            showBanner()
            console.log(` * See README.md inside your project folder to setup provisioning account...\n`)
            console.log(`   1. Setup AWS Account  \t: ${CBEGIN}npm run account-setup ${CRESET}`)
            console.log(`   2. Install Packages   \t: ${CBEGIN}npm install ${CRESET}`)
            console.log(`   3. Deploy AWS Stacks  \t: ${CBEGIN}npm run stack-deploy ${CRESET}`)
            console.log(`   4. Push Code Functions\t: ${CBEGIN}npm run push-code ${CRESET}`)
            console.log(`   5. Run your test specs\t: ${CBEGIN}npm run test ${CRESET}`)
            console.log(`   6. Update Environments\t: ${CBEGIN}npm run push-update ${CRESET}`)
            console.log(`   7. Monitor Metrics    \t: ${CBEGIN}npm run monitor-metric ${CRESET}`)
            console.log(`   8. Destroy AWS Stacks \t: ${CBEGIN}npm run stack-destroy ${CRESET}`)
            console.log(`   9. Cleanup AWS Account\t: ${CBEGIN}npm run account-cleanup ${CRESET}\n`)
            
            console.log(`   Project Id\t: ${projectInfo.PROJECT_Id} `);
            console.log(`   Account Id\t: ${projectInfo.ENV_AccountId} `);
            console.log(`   Profile\t: ${projectInfo.ENV_Profile} `);
            console.log(`   Bucket\t: ${projectInfo.ENV_Bucket} `);
            console.log(`   Region\t: ${projectInfo.ENV_Region} `);
            console.log(`   Environment\t: ${projectInfo.ENV_Name} \n`);

            console.log(` * Create NEW environment: simplify-graphql -i schema.graphql --env=NAME\n`);
            console.log(` - Automatic code merge is ${argv.merge ? 'on (remove option --merge to turn off)' : 'off (use option --merge to turn on)'}`)
            console.log(` - Diff file generation is ${argv.diff ? 'on (remove option --diff to turn off)' : 'off (use option --diff to turn on)'}`)
            console.log(` - Override custom code is ${argv.override ? 'on (remove option --override to turn off)' : 'off (use option --override to turn on)'} \n`)    
        }
    }
}, function (err) {
    console.error(`${err}`)
})
