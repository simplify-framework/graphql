'use strict';
const fs = require('fs')
const path = require('path')
const { ApolloServer, gql } = require('apollo-server');
const schema = fs.readFileSync(path.resolve(__dirname, 'graphql.schema'), 'utf8')
const typeDefs = gql(schema);
const Book = require('./DataModels/Book')
const Author = require('./DataModels/Author')

const resolvers = {
    Query: {
    // POST /query using NONE authorization with ApiKey=false
        listBooks: () => new GraphQLFunction("listBookFunction"),
        getBook: () => new GraphQLFunction("getBookFunction")
    // END
    },
    Mutation: {
    // POST /book/admin using SIGV4 authorization with ApiKey=true
        addBook: () => new GraphQLFunctionSet("addBookFunctionSet"),
        deleteBook: () => new GraphQLFunction("deleteBookFunction")
    ,
    // POST /book/user using COGNITO authorization with ApiKey=
        readBook: () => new GraphQLFunction("readBookFunction"),
        likeBook: () => new GraphQLFunction("listBookFunction")
    // END
    }
}

const server = new ApolloServer({
    typeDefs, resolvers, dataSources: () => ({
        Book: () => new DataSource("TABLE_STORAGE", "starwarsBookTable", Book),
        Author: () => new DataSource("BLOB_STORAGE", "starwarsAuthorStorage", Author)
    })
})

server.listen().then(({ url }) => {
    console.log(`GraphQL server is ready at ${url}`)
})