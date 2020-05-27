'use strict';


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
                arrayOrObject[i] = { value: arrayOrObject[i] }
            } if (Array.isArray(arrayOrObject[i])) {
                console.log(arrayOrObject[i])
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

function objectFieldParse(obj, name) {
    let result = {}
    if (obj.kind === "InputObjectTypeDefinition" || obj.kind === "ObjectTypeDefinition") {
        obj.fields.map(fobj => {
            if (!Array.isArray(result)) result = []
            result.push({ Type: name, Name: fobj.name.value, Value: objectFieldParse(fobj.type) })
        })
        result = convertToArrayWithNotation(result)
    } else if (obj.kind === "NamedType") {
        result = obj.name.value
    } else if (obj.kind === "NonNullType") {
        result = objectFieldParse(obj.type)
    } else if (obj.kind === "InputValueDefinition") {
        result = { Type: name, Name: obj.name.value, Value: obj.type.type.name.value }
    } else if (obj.kind === "FieldDefinition") {
        console.log(obj)
    } else if (obj.kind === "EnumTypeDefinition") {
        obj.values.map(fobj => {
            if (!Array.isArray(result)) result = []
            result.push({ Type: name, Name: fobj.name.type, Value: objectFieldParse(fobj.name) })
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
        DataModel: field.type.type ? field.type.type.name.value : field.type.name.value,
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
                } else if (obj.Kind === "GraphQLFunction") {
                    rootObject.Servers[serverName].Function = obj
                    if (!rootObject.Servers[serverName].Paths) {
                        rootObject.Servers[serverName].Paths = {}
                    }
                    if (!rootObject.Servers[serverName].Paths[endpointPath]) {
                        rootObject.Servers[serverName].Paths[endpointPath] = { Operations: [] }
                    }
                    rootObject.Servers[serverName].Paths[endpointPath].Operations.push(obj)
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
                                if (!rootObject.Servers[serverName].Paths) {
                                    rootObject.Servers[serverName].Paths = {}
                                }
                                if (!rootObject.Servers[serverName].Paths[endpointPath]) {
                                    rootObject.Servers[serverName].Paths[endpointPath] = { Operations: [], Path: endpointPath }
                                }
                                obj.OperationId = fields.Name
                                obj.DataType = fields.DataType
                                obj.DataModel = fields.DataModel
                                obj = extendObjectValue(obj, "OperationId", obj.OperationId)
                                obj.Parameters = convertToArrayWithNotation(fieldArguments.Arguments)
                                rootObject.Servers[serverName].Paths[endpointPath].Operations.push(obj)
                                rootObject.Servers[serverName].Paths[endpointPath].Options = obj.Options
                            } else if (obj.Kind === "GraphQLFunction" || obj.Kind === "GraphQLFunctionSet") {
                                if (!rootObject.Servers[serverName].Paths) {
                                    rootObject.Servers[serverName].Paths = {}
                                }
                                if (!rootObject.Servers[serverName].Paths[endpointPath]) {
                                    rootObject.Servers[serverName].Paths[endpointPath] = { Operations: [], Path: endpointPath }
                                }
                                const operation = rootObject.Servers[serverName].Paths[endpointPath].Operations.find(o => o.OperationId === fields.Name)
                                if (operation) {
                                    obj.FunctionType = obj.Kind === "GraphQLFunction" ? "Method" : "Function"
                                    operation.Function = obj
                                    if (operation.Function.Chains)
                                        operation.Function.Chains = convertToArrayWithNotation(operation.Function.Chains)
                                    operation.Function = extendObjectValue(operation.Function, "Name", obj.Name)
                                }
                            }
                        })
                    }
                })
            }

        }
    })
    return rootObject
}

function hoganFlatter(rootObject) { 
    rootObject.Servers = convertToArrayWithNotation(rootObject.Servers)
    rootObject.Servers = rootObject.Servers.map(server => {
        let pathsArray = convertToArrayWithNotation(server.Paths)
        pathsArray = pathsArray.map(path => {
            return { ...path, Operations: convertToArrayWithNotation(path.Operations) }
        })
        return { ...server, Paths: convertToArrayWithNotation(pathsArray) }
    })
    rootObject.Servers = convertToArrayWithNotation(rootObject.Servers)

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
            UserType: ["GraphQLOptions", "GraphQLDataIndex", "FunctionInput", "ChainInput"].indexOf(kinput) === -1,
            Name: kinput,
            Type: "DataInput",
            Value: rootObject.DataInputs[kinput]
        }
    })
    rootObject.DataInputs = convertToArrayWithNotation(rootObject.DataInputs)

    rootObject.EnumObjects = Object.keys(rootObject.EnumObjects).map(kenum => {
        return {
            UserType: ["GraphQLEngineType", "AuthorizationMode", "GraphQLSourceType", "GraphQLEventType", "GraphQLDataAccess"].indexOf(kenum) === -1,
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
    schemaParser: schemaParser
}