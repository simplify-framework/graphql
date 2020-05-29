'use strict';
const fs = require('fs')
const path = require('path')
const { ApolloServer, gql } = require('apollo-server');
const schema = fs.readFileSync(path.resolve(__dirname, 'graphql.schema'), 'utf8')
const typeDefs = gql(schema);

const listBookFunction = require('./States/listBookFunction')
const getBookFunction = require('./States/getBookFunction')
const addBookFunctionSet = require('./States/addBookFunctionSet')
const deleteBookFunction = require('./States/deleteBookFunction')
const readBookFunction = require('./States/readBookFunction')
const listBookFunction = require('./States/listBookFunction')

const resolvers = {
    Query: {
    // POST /query using NONE authorization with ApiKey=false
        listBooks: (parent, args, context, info) => listBookFunction(parent, args, context, info),
        getBook: (parent, args, context, info) => getBookFunction(parent, args, context, info)
    // END
    },
    Mutation: {
    // POST /book/admin using SIGV4 authorization with ApiKey=true
        addBook: (parent, args, context, info) => addBookFunctionSet(parent, args, context, info),
        deleteBook: (parent, args, context, info) => deleteBookFunction(parent, args, context, info)
    ,
    // POST /book/user using COGNITO authorization with ApiKey=
        readBook: (parent, args, context, info) => readBookFunction(parent, args, context, info),
        likeBook: (parent, args, context, info) => listBookFunction(parent, args, context, info)
    // END
    }
}

const server = new ApolloServer({
    typeDefs, resolvers
})

server.listen().then(({ url }) => {
    console.log(`GraphQL server is ready at ${url}`)
})