#!/usr/bin/env node
'use strict';
const fs = require('fs')
const path = require('path')
const Hogan = require('hogan.js');
const mkdirp = require('mkdirp');
const gql = require('graphql-tag');
const { schemaParser, hoganFlatter } = require('./transformer')

function buildTemplateFile(data, tplFile) {
    const oFile = fs.readFileSync(path.resolve(__dirname, tplFile), 'utf8')
    let template = Hogan.compile(oFile);
    return template.render(data, {});
}

function writeTemplateFile(tplFile, data, outputPath, file) {
    const dataFile = buildTemplateFile(data, tplFile)
    var filename = path.join(outputPath, file)
    if (!fs.existsSync(outputPath)) {
        mkdirp.sync(outputPath);
    }
    fs.writeFileSync(filename, dataFile, 'utf8');
}

var argv = require('yargs')
    .usage('simplify-graphql [options]')
    .string('input')
    .alias('i', 'input')
    .describe('input', 'Input serveless spec YAML or function-arns.txt')
    .string('output')
    .alias('o', 'output')
    .describe('output', 'output directory')
    .default('output', './')
    .boolean('verbose')
    .describe('verbose', 'Increase verbosity')
    .alias('v', 'verbose')
    .demandOption(['i', 'o'])
    .demandCommand(0)
    .argv;

function runCommandLine() {
    try {
        const schema = fs.readFileSync(path.resolve(__dirname, argv.input), 'utf8')
        const typeDefs = gql(schema);
        mainProcessor(typeDefs)
    } catch (err) {
        console.error(`${err}`)
    }
}

function mainProcessor(typeDefs) {
    const rootObject = hoganFlatter(schemaParser(typeDefs))
    console.log("Generating Verbal GASM Design Language... (graphql.txt)")
    writeTemplateFile("templates/graphql.mustache", rootObject, "./", "graphql.txt")
    writeTemplateFile("templates/app.mustache", rootObject, "./", "app.js")
    rootObject.DataObjects.map(data => {
        if (data.UserType) writeTemplateFile("templates/model.mustache", data, "./GraphQL/Models", `${data.Name}.js`)
    })
    rootObject.DataInputs.map(data => {
        if (data.UserType) writeTemplateFile("templates/input.mustache", data, "./GraphQL/Inputs", `${data.Name}.js`)
    })
    rootObject.EnumObjects.map(data => {
        if (data.UserType) writeTemplateFile("templates/enum.mustache", data, "./GraphQL/Enums", `${data.Name}.js`)
    })
    rootObject.Servers.map(server => {
        server.Paths.map(path => {
            path.Operations.map(operation => {
                if (operation.Function.Kind == "GraphQLFunction") {
                    writeTemplateFile("templates/state-function.mustache", operation.Function, "./GraphQL/StateMachine", `${operation.Function.Name}.js`)
                } else {
                    writeTemplateFile("templates/state-functionset.mustache", operation.Function, "./GraphQL/StateMachine", `${operation.Function.Name}.js`)
                }
                operation.Function.Chains && operation.Function.Chains.map(chain => {
                    writeTemplateFile("templates/function.mustache", chain, "./GraphQL/Functions", `${chain.Run.Name}.js`)
                    chain.Next !== "DONE" && writeTemplateFile("templates/function.mustache", chain, "./GraphQL/Functions", `${chain.Next}.js`)
                    chain.Other !== "DONE" && writeTemplateFile("templates/function.mustache", chain, "./GraphQL/Functions", `${chain.Other}.js`)
                })
            })
        })
    })
}

runCommandLine()