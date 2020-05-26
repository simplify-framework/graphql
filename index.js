const fs = require('fs')
const path = require('path')
const { ApolloServer, gql } = require('apollo-server');
const schema = fs.readFileSync(path.resolve(__dirname, 'graphql.schema'), 'utf8')
const typeDefs = gql(schema);

const books = [
    {
        title: 'Harry Potter and the Chamber of Secrets',
        author: {
            name: () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve('J.K. Rowling Promise')
                    }, 3000)
                })
            }
        }
    },
    {
        title: 'Jurassic Park',
        author: {
            name: () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve('Michael Crichton Promise')
                    }, 1000)
                })
            }
        },
    },
];

const resolvers = {
    Query: {
        listBooks: () => books,
    },
    Mutation: {
        //fieldName: (parent, args, context, info) => data;
        addBook: (parent, { title, author }, { dataSources }) => {
            console.log(parent, title, author, dataSources)
            books.push({ title, author: { name: author.name } })
            console.log(books)
            return books
        }
    }
};

const server = new ApolloServer({
    typeDefs, resolvers, dataSources: () => ({
        launchAPI: function () { },
        userAPI: function () { }
    })
});

server.listen().then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
});