'use strict';
const { v4: uuidv4 } = require('uuid')
const crypto = require("crypto")

String.prototype.toTextSpace = function () {
    return this.replace(/([A-Z])/g, (match) => ` ${match}`)
        .replace(/^./, (match) => match.toUpperCase())
        .trim()
}

String.prototype.toSnakeCase = function () {
    return this.toPascalCase().replace(/([A-Z])/g, (match) => `-${match}`)
        .replace(/^./, (match) => match.toLowerCase())
        .trim().toLowerCase().slice(1)
}

String.prototype.toCamelCase = function () {
    return this.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '').split(' ').join('').split('-').join('');
}

String.prototype.toUnderscore = function () {
    return this.toSnakeCase().split('-').join('_');
}

String.prototype.toPascalCase = function () {
    return this
        .replace(new RegExp(/[-_]+/, 'g'), ' ')
        .replace(new RegExp(/[^\w\s]/, 'g'), '')
        .replace(
            new RegExp(/\s+(.)(\w+)/, 'g'),
            ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
        )
        .replace(new RegExp(/\s/, 'g'), '')
        .replace(new RegExp(/\w/), s => s.toUpperCase()).split(' ').join('').split('-').join('');
};

function convertToArrayWithNotation(arrayOrObject, debug) {
    if (!arrayOrObject) arrayOrObject = [];
    if (Array.isArray(arrayOrObject) && arrayOrObject.length) {
        arrayOrObject.isEmpty = false;
        for (let i = 0; i < arrayOrObject.length; i++) {
            if (typeof (arrayOrObject[i]) === 'string') {
                arrayOrObject[i] = { Value: arrayOrObject[i] }
            }
            arrayOrObject[i]['-first'] = (i === 0);
            arrayOrObject[i]['-last'] = (i === arrayOrObject.length - 1);
            arrayOrObject[i].hasMore = (i < arrayOrObject.length - 1);
        }
    } else {
        if (typeof arrayOrObject === 'object') {
            let resultArr = []
            Object.keys(arrayOrObject).map((k, i) => {
                resultArr.push(arrayOrObject[k])
                resultArr[i]['-first'] = (i === 0);
                resultArr[i]['-last'] = (i === arrayOrObject.length - 1);
                resultArr[i].hasMore = (i < arrayOrObject.length - 1);
            })
            arrayOrObject = resultArr
        } else { arrayOrObject.isEmpty = true; }
    }
    return arrayOrObject;
}

function extendObjectValue(obj, key, value) {
    obj[key] = value
    if (typeof (value) === 'string') {
        obj[key + "Pascal"] = value.toPascalCase()
        obj[key + "Camel"] = value.toCamelCase()
        obj[key + "Snake"] = value.toSnakeCase()
        obj[key + 'Underscore'] = value.toUnderscore()
    } else if (typeof (value) === 'number') {
        obj[key + 'Number'] = (value || 0)
    } else if (typeof (value) === 'boolean') {
        obj[key + 'Boolean'] = (value || false)
    } else if (typeof (value) === 'object') {
        if (Array.isArray(value)) {
            obj[key + 'Array']  = convertArray(value || [])
        } else {
            obj[key + 'Object'] = (value || {})
        }
    } else {
        obj[key] = (value || undefined)
    }
    return obj
}

function objectValueParse(obj) {
    let result = {}
    if (obj.kind === "ListValue") {
        result = obj.values.map(v => {
            let fieldObj = {}
            v.fields.map(vf => {
                fieldObj[vf.name.value] = objectValueParse(vf.value)
            })
            return fieldObj
        })
    } else if (obj.kind === "ObjectValue") {
        obj.fields.map(f => {
            result[f.name.value] = objectValueParse(f.value)
        })
    } else if (obj.kind === "ObjectField") {
        result[obj.name.value] = objectValueParse(obj.value)
    } else if (obj.kind === "BooleanValue") {
        result = obj.value
    } else if (obj.kind === "IntValue") {
        result = parseInt(obj.value || 0)
    } else if (obj.kind === "FloatValue") {
        result = parseFloat(obj.value)
    } else {
        result = obj.value || undefined
    }
    return result
}

function parseObjectType(obj, name, def) {
    if (obj === "DateTime" || obj === "List" || obj === "String" || obj === "ID" || obj === "Boolean" ||  obj === "Int" || obj === "Float") {
        obj = { Name: name, Value: obj, isScalarType: true }
        obj = generateRandomValue(obj)
    } else {
        obj = generateRandomValue({ Name: name || 'type', Value: obj, isObjectType: true })
    }
    return obj
}

function objectFieldParse(obj, name) {
    let result = {}
    if (obj.kind === "InputObjectTypeDefinition" || obj.kind === "ObjectTypeDefinition") {
        obj.fields.map(fobj => {
            if (!Array.isArray(result)) result = []
            result.push({ Type: name, Name: fobj.name.value, Value: objectFieldParse(fobj.type, fobj.name.value) })
        })
        result = convertToArrayWithNotation(result)
    } else if (obj.kind === "ListType") {
        result = generateRandomValue({ Name: name, Value: obj.type.name.value, isListType: true })
    } else if (obj.kind === "NamedType") {
        result = parseObjectType(obj.name.value, name, obj)
    } else if (obj.kind === "NonNullType") {
        result = objectFieldParse(obj.type, name)
    } else if (obj.kind === "InputValueDefinition") {
        result = { Type: name, Name: obj.name.value, Value: obj.type.type.name.value }
    } else if (obj.kind === "FieldDefinition") {
        console.log(obj)
    } else if (obj.kind === "EnumTypeDefinition") {
        obj.values.map(fobj => {
            if (!Array.isArray(result)) result = []
            result.push({ Type: name, Name: fobj.name.type, Value: objectFieldParse(fobj.name, fobj.name.value) })
        })
        result = convertToArrayWithNotation(result)
    } else if (obj.kind === "EnumValueDefinition") {
        result = obj.value
    } else {
        result = obj.value
    }
    
    return result || undefined
}

function objectDirectiveParser(def) {
    const directives = def.directives.map(d => {
        let argsField = {}
        const args = d.arguments.map(arg => {
            argsField[arg.name.value] = arg.value.value ? arg.value.value : objectValueParse(arg.value)
            return {
                toString: () => `${arg.name.value}=${arg.value.value}`
            }
        })
        return {
            toString: () => `@${d.name.value} (${args.toString()})`,
            Kind: d.name.value,
            ...argsField
        }
    })
    return {
        toString: () => (`${def.name.value.toUpperCase()}\n * ${def.name.value === 'Query' || def.name.value === 'Mutation' ? 'Endpoint' : 'Data'}Directive: ${directives}`),
        Name: def.name.value,
        Directives: directives
    }
}

function fieldDirectiveParser(field) {
    const directives = field.directives.map(d => {
        let argsField = {}
        const args = d.arguments.map(arg => {
            argsField[arg.name.value] = arg.value.value ? arg.value.value : objectValueParse(arg.value)
            return {
                toString: () => `${arg.name.value}=${arg.value.value ? arg.value.value : objectValueParse(arg.value).toString()}`
            }
        })
        return {
            toString: () => `@${d.name.value} (${args.toString()})`,
            Kind: d.name.value,
            ...argsField
        }
    })
    return {
        toString: () => (`${directives}`),
        Name: field.name.value,
        DataType: field.type.kind,
        DataSchema: field.type.type ? field.type.type.name.value : field.type.name.value,
        Directives: directives
    }
}

function fieldArgumentParser(field) {
    const farguments = field.arguments.map(arg => {
        return {
            toString: () => `${arg.kind}=${arg.name.value}:${arg.type.name.value}`,
            Name: arg.name.value,
            Kind: arg.type.name.value
        }
    })
    return {
        toString: () => (`${field.name.value}(${farguments.toString()}) => ${field.type.kind}(${field.type.type ? field.type.type.name.value : field.type.name.value})`),
        Name: field.name.value,
        Arguments: farguments
    }
}

function generateRandomValue(obj) {
    function randomInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomNumber(min, max) {
        return Math.random() * (max - min) + min;
    }
    if (obj.isListType) {
        if (obj.Value == "String") {
            obj.Default = convertToArrayWithNotation([ crypto.randomBytes(8).toString("hex"), crypto.randomBytes(8).toString("hex"), crypto.randomBytes(8).toString("hex") ])
            obj.isListStringType = true
        } else {
            obj.Default = convertToArrayWithNotation([obj.Value])
            obj.isListObjectType = true
        }
    } else if (obj.isObjectType) {
    } else if (obj.Value === "String") {
        obj.Default = crypto.randomBytes(8).toString("hex")
        obj.isStringType = true
        obj.isQuotedType = true
    } else if (obj.Value === "ID") {
        obj.Default = uuidv4()
        obj.isStringType = true
        obj.isQuotedType = true
    } else if (obj.Value === "Boolean" || obj.Value === "Bool") {
        obj.Default = Math.random() >= 0.5 ? true : false
        obj.isBoolType = true
    } else if (obj.Value === "Int") {
        obj.isIntType = true
        obj.Default = randomInteger(0, 9999)
    } else if (obj.Value === "Float") {
        obj.Default = randomNumber(0, 9999)
        obj.isFloatType = true
    } else if (obj.Value === "DateTime") {
        obj.Default = new Date().toISOString()
        obj.isDateTimeType = true
        obj.isQuotedType = true
    } else {
        obj.isObjectType = true
    }
    return obj
}

function getServerRuntime(obj) {
    obj.Runtime = obj.Runtime || 'nodejs12.x'
    if (obj.Runtime.startsWith('python')) {
        obj.RuntimeCode = obj.RuntimeCode || `def handler(event, context): return { 'statusCode': 200, 'body': '{}' }`
        obj.Language = 'py'
    } else if (obj.Runtime.startsWith('nodej')) {
        obj.RuntimeCode = obj.RuntimeCode || `exports.handler = function (event, context, callback) { callback(null, { statusCode: 200, body: JSON.stringify({}) })}`
        obj.Language = 'js'
    } else {
        console.error(` - Gateway Runtime ${obj.Runtime} is not supported!`)
        process.exit(255)
    }
    return obj
}

function getResolverRuntime(obj) {
    obj.Runtime = obj.Runtime || 'nodejs12.x'
    if (obj.Runtime.startsWith('python')) {
        obj.RuntimeCode = obj.RuntimeCode || `def handler(event, context): return { 'foo': 'bar' }`
        obj.Language = 'py'
    } else if (obj.Runtime.startsWith('nodej')) {
        obj.RuntimeCode = obj.RuntimeCode || `exports.handler = function (event, context, callback) { callback(null, { 'foo': 'bar' }) }`
        obj.Language = 'js'
    } else {
        console.error(` - Remote Runtime ${obj.Runtime} is not supported!`)
        process.exit(255)
    }
    return obj
}

function schemaParser(typeDefs) {
    let rootObject = { Servers: {}, Events: {}, DataSources: {}, DataInputs: {}, DataObjects: {}, EnumObjects: {} }
    let dataSourceName = null
    let serverName = null
    let eventName = null

    typeDefs.definitions.map(def => {
        if (def.kind === "InputObjectTypeDefinition") {
            if (!rootObject.DataInputs) {
                rootObject.DataInputs = []
            }
            rootObject.DataInputs[def.name.value] = objectFieldParse(def, def.name.value)
        } else if (def.kind === "ObjectTypeDefinition") {
            if (!rootObject.DataObjects) {
                rootObject.DataObjects = []
            }
            rootObject.DataObjects[def.name.value] = objectFieldParse(def, def.name.value)
        } else if (def.kind === "EnumTypeDefinition") {
            if (!rootObject.EnumObjects) {
                rootObject.EnumObjects = []
            }
            rootObject.EnumObjects[def.name.value] = objectFieldParse(def, def.name.value)
        }
        if (def.directives && def.directives.length) {
            const defs = objectDirectiveParser(def)
            let endpointPath = '/'
            defs.Directives.map(obj => {
                obj.Definition = defs.Name
                if (obj.Kind === "GraphQLServer") {
                    serverName = serverName !== obj.Name ? obj.Name : serverName
                    if (!rootObject.Servers[serverName]) {
                        obj = extendObjectValue(obj, "Name", obj.Name)
                        rootObject.Servers[serverName] = obj
                        if (!obj.Options) obj.Options = {}
                        obj = getServerRuntime(obj)
                        obj.Options.BurstLimit = obj.Options.BurstLimit || 100
                        obj.Options.RateLimit = obj.Options.RateLimit || 10
                        obj.Options.QuotaLimit = obj.Options.QuotaLimit || 100
                        obj.Options.QuotaUnit = obj.Options.QuotaUnit || 'DAY'
                        rootObject.Servers[serverName].Definitions = [ { Definition: obj.Definition } ]
                    } else {
                        rootObject.Servers[serverName].Definitions.push({ Definition: obj.Definition })
                    }
                } else if (obj.Kind === "GraphQLEvent") {
                    eventName = eventName !== obj.Name ? obj.Name : eventName
                    if (!rootObject.Events[eventName]) {
                        obj = extendObjectValue(obj, "Function", obj.Function)
                        rootObject.Events[eventName] = { ...obj, Parameters: defs.Parameters }
                    } else {
                        console.error(` * Duplicate Event: \`${eventName}\` on ${defs.Name.toUpperCase()}`)
                        process.exit(-1)
                    }
                } else if (obj.Kind === "GraphQLDataSource") {
                    dataSourceName = dataSourceName !== obj.Name ? obj.Name : dataSourceName
                    if (!rootObject.DataSources[dataSourceName]) {
                        rootObject.DataSources[dataSourceName] = { ...obj, Parameters: defs.Parameters }
                    } else {
                        console.error(` * Duplicate DataSource: \`${dataSourceName}\` on ${defs.Name.toUpperCase()}`)
                        process.exit(-1)
                    }
                } else if (obj.Kind === "GraphQLResolver") {
                    const serverDef = rootObject.Servers[serverName].Definitions.find(defin => defin.Definition == obj.Definition)
                    rootObject.Servers[serverName].Resolver = obj
                    if (!serverDef.Paths) {
                        serverDef.Paths = {}
                    }
                    if (!serverDef.Paths[endpointPath]) {
                        serverDef.Paths[endpointPath] = { Resolvers: [] }
                    }
                    serverDef.Paths[endpointPath].Resolvers.push(obj)
                }
            })
            if (def.name.value === "Mutation" || def.name.value === "Query") {
                def.fields && def.fields.map(f => {
                    const fieldArguments = fieldArgumentParser(f)
                    if (f.directives && f.directives.length) {
                        const fields = fieldDirectiveParser(f)
                        let endpointPath = '/'
                        fields.Directives.map(obj => {
                            if (obj.Kind === "GraphQLEndpoint") {
                                endpointPath = obj.Path || '/'
                                const serverDef = rootObject.Servers[serverName].Definitions.find(defin => defin.Definition == def.name.value)
                                if (!serverDef.Paths) {
                                    serverDef.Paths = {}
                                }
                                if (!serverDef.Paths[endpointPath]) {
                                    serverDef.Paths[endpointPath] = { Resolvers: [], Path: endpointPath }
                                }
                                obj.OperationId = fields.Name
                                obj.DataType = fields.DataType
                                obj.DataSchema = fields.DataSchema
                                if (!obj.Options) obj.Options = {}
                                obj.Options.ApiKey = obj.Options.ApiKey || false
                                if (obj.Options.AuthMode === "SIGV4") obj.Options.HasSigv4 = true
                                if (obj.Options.AuthMode === "COGNITO") obj.Options.HasAuthorizer = true
                                obj = extendObjectValue(obj, "OperationId", obj.OperationId)
                                obj.Parameters = convertToArrayWithNotation(fieldArguments.Arguments)
                                serverDef.Paths[endpointPath].Resolvers.push(obj)
                                serverDef.Paths[endpointPath].Options = obj.Options
                            } else if (obj.Kind === "GraphQLResolver" || obj.Kind === "GraphQLResolverSet") {
                                const serverDef = rootObject.Servers[serverName].Definitions.find(defin => defin.Definition == def.name.value)
                                if (!serverDef.Paths) {
                                    serverDef.Paths = {}
                                }
                                if (!serverDef.Paths[endpointPath]) {
                                    serverDef.Paths[endpointPath] = { Resolvers: [], Path: endpointPath }
                                }
                                const resolver = serverDef.Paths[endpointPath].Resolvers.find(o => o.OperationId === fields.Name)
                                if (resolver) {
                                    obj.ResolverType = obj.Kind === "GraphQLResolver" ? "Method" : "Function"
                                    resolver.Resolver = obj
                                    if (resolver.Resolver.Chains) {
                                        resolver.Resolver.Chains = convertToArrayWithNotation(resolver.Resolver.Chains)
                                    }
                                    resolver.Resolver = extendObjectValue(resolver.Resolver, "Name", obj.Name)
                                }
                            }
                        })
                    }
                })
                rootObject.Servers[serverName].Definitions = convertToArrayWithNotation(rootObject.Servers[serverName].Definitions) 
            }
        }
    })
    return rootObject
}

function hoganFlatter(rootObject) { 
    rootObject.Functions = []
    rootObject.Servers = convertToArrayWithNotation(rootObject.Servers)
    rootObject.Servers = rootObject.Servers.map(server => {
        server.Definitions = server.Definitions.map(serverDef => {
            let pathsArray = convertToArrayWithNotation(serverDef.Paths)
            pathsArray = pathsArray.map(path => {
                path.Resolvers.map(resolver => {
                    resolver.Resolver.Chains && resolver.Resolver.Chains.map(chain => {
                        if (chain.Run.Mode == "REMOTE") {
                            chain.RemoteExecutionMode = true
                            chain.Run = getResolverRuntime(chain.Run)
                            let remoteFuncDefinition = rootObject.Functions.find(func => func.FunctionName == chain.Run.Name)
                            if (!remoteFuncDefinition) {
                                const isResultListType = resolver.DataType == "ListType"
                                remoteFuncDefinition = { FunctionName: chain.Run.Name, ...chain.Run, Servers: [{ ServerName: server.Name }], ...resolver, isResultListType }
                                remoteFuncDefinition.Servers = convertToArrayWithNotation(remoteFuncDefinition.Servers)
                                remoteFuncDefinition = extendObjectValue(remoteFuncDefinition, "FunctionName", chain.Run.Name)
                                rootObject.Functions.push(remoteFuncDefinition)
                            } else {
                                remoteFuncDefinition.Servers.push({ ServerName: server.Name })
                                remoteFuncDefinition.Servers = convertToArrayWithNotation(remoteFuncDefinition.Servers)
                            }
                        }
                    })
                })                
                return { ...path, Resolvers: convertToArrayWithNotation(path.Resolvers) }
            })
            return { ...serverDef, Paths: convertToArrayWithNotation(pathsArray) }
        })
        return { ...server, Definitions: server.Definitions }
    })
    rootObject.Servers = convertToArrayWithNotation(rootObject.Servers)
    rootObject.Functions = convertToArrayWithNotation(rootObject.Functions)
    rootObject.hasFunction = rootObject.Functions.length > 0 ? true : false
    rootObject.Events = convertToArrayWithNotation(rootObject.Events)
    rootObject.DataSources = convertToArrayWithNotation(rootObject.DataSources)
    rootObject.DataObjects = Object.keys(rootObject.DataObjects).map(kobj => {
        return {
            UserType: ["Query", "Mutation"].indexOf(kobj) === -1,
            Name: kobj,
            Type: "DataObject",
            Value: rootObject.DataObjects[kobj]
        }
    })
    rootObject.DataSources = convertToArrayWithNotation(rootObject.DataSources)

    rootObject.DataInputs = Object.keys(rootObject.DataInputs).map(kinput => {
        return {
            UserType: ["GraphQLServerOptions", "GraphQLEndpointOptions", "GraphQLDataIndex", "FunctionInput", "ChainInput"].indexOf(kinput) === -1,
            Name: kinput,
            Type: "DataInput",
            Value: rootObject.DataInputs[kinput]
        }
    })
    rootObject.DataInputs = convertToArrayWithNotation(rootObject.DataInputs)

    rootObject.EnumObjects = Object.keys(rootObject.EnumObjects).map(kenum => {
        return {
            UserType: ["GraphQLEngineType", "GraphQLAuthMode", "GraphQLExecutionMode", "GraphQLSourceType", "GraphQLEventType", "GraphQLDataAccess"].indexOf(kenum) === -1,
            Name: kenum,
            Type: "EnumObject",
            Value: rootObject.EnumObjects[kenum]
        }
    })
    rootObject.EnumObjects = convertToArrayWithNotation(rootObject.EnumObjects)

    return rootObject
}

module.exports = {
    hoganFlatter: hoganFlatter,
    schemaParser: schemaParser,
    extendObjectValue: extendObjectValue,
    generateRandomValue: generateRandomValue,
    convertToArrayWithNotation: convertToArrayWithNotation
}
