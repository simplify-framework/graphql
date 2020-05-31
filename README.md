# Simplify Framework - GraphQL Serverless Architecture Model (GSAM)

![NPM Downloads](https://img.shields.io/npm/dw/simplify-graphql)
![Package Version](https://img.shields.io/github/package-json/v/simplify-framework/graphql?color=green)

## HOW TO: Build a GraphQL project:
- `npm install -g simplify-graphql`
- `simplify-graphql -i schema.graphql`

> It will help you to create your project step by step...

    * GraphQL Schema 'schema.graphql' is not found.
    - Do you want to generate a schema sample? [y/n]: y
    - What is your Project name? starwars
    - What is your Project description? This is a starwars III program
    - What is your Project Id? (f8e01fcde7b236cb): 
    - What is your Deployment Bucket? (starwars-deployment-eu-west-1): 
    - What is your Deployment Region? (eu-west-1): 
    - What is your Deployment Profile? (simplify-eu): 
    - What is your AWS Account Id? your_aws_account_id_here
    - Do you want to use Secret Manager as KeyVault? [y/n]: n
    - What is your Endpoint ApiKey? (db3349f149ba09049a9128b09255a6f0888c64c7): 

## HOW TO: Test your GraphQL API server
```JavaScript
const Queries = `
query GetBooksAndAuthors {
    listBooks {
        title
        author {
            id
            name
            type
        }
    }
}

mutation CreateNewBook {
    addBook(title: "Fox in Socks",
    author: {
        name: "Dr. Seuss"
    })
    {
        title
        author {
            id
            name
        }
    }
}`

let GetBooksAndAuthors = {
    "operationName": "GetBooksAndAuthors",
    "variables": {},
    "query": Queries
}

fetch("https://StarwarServerQuery.../latest/query", {
    "headers": {
        "content-type": "application/json"
    },
    "body": JSON.stringify(GetBooksAndAuthors),
    "method": "POST",
    "mode": "cors"
});
```

## The StarWars Verbal Architecture Model
```
* @GraphQLServer Name=graphApiGatewayQuery run on LAMBDA
    FOR EVERY (Query)
        POST /query using NONE authorization with ApiKey=false
            listBooks [] => ListType() will execute @GraphQLResolver=listBookFunction
            getBook [title=String] => NamedType() will execute @GraphQLResolver=getBookFunction
* @GraphQLServer Name=graphApiGatewayMutation run on LAMBDA
    FOR EVERY (Mutation)
        POST /book/admin using SIGV4 authorization with ApiKey=true
            addBook [title=String, author=AuthorInput] => ListType() will execute @GraphQLResolverSet=addBookFunctionSet
                    Function=checkBookExisted() onSuccess=addNewBook() onFailure=doneNewBook() RetryOnFailure=3
                    Function=addNewBook() onSuccess=doneNewBook() onFailure=errorNewBook() RetryOnFailure=
                    Function=doneNewBook() onSuccess=DONE() onFailure=DONE() RetryOnFailure=
                    Function=errorNewBook() onSuccess=DONE() onFailure=DONE() RetryOnFailure=
            deleteBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=deleteBookFunction
        POST /book/user using COGNITO authorization with ApiKey=
            readBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=readBookFunction
                    Method=checkBookPaid() onSuccess=readNewBook() onFailure=errorPaidBook() RetryOnFailure=
                    Method=readNewBook() onSuccess=doneReadBook() onFailure=DONE() RetryOnFailure=
                    Method=doneReadBook() onSuccess=DONE() onFailure=DONE() RetryOnFailure=
                    Method=errorPaidBook() onSuccess=DONE() onFailure=DONE() RetryOnFailure=
            likeBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=likeBookFunction

* Will execute Function=onBookSchedule on EVENT_RULE=scheduleOnBookEvent(every(10 mins)) => accessible to [Book] with Access=READ_ONLY
* Will execute Function=onAuthorSchedule on TABLE_STORAGE=starwarsBookTable(UPDATE|CREATE) => accessible to [Author] with Access=READ_WRITE

* [Book] persists on DataSource=TABLE_STORAGE@starwarsBookTable has Indexes=title:String,
* [Author] persists on DataSource=BLOB_STORAGE@starwarsAuthorStorage has Indexes=name:String

* [DataInput] AuthorInput { name=[object Object], type=[object Object]  }

* [EnumObject] AuthorType { ROMAN, SCIENTIST  }

* [DataObject] Book { title=[object Object], author=[object Object], comments=[object Object], outofstock=[object Object], types=[object Object]  }
* [DataObject] Author { id=[object Object], name=[object Object], type=[object Object]  }
- [DataObject] Query { listBooks (...) getBook (...)  }
- [DataObject] Mutation { addBook (...) deleteBook (...) readBook (...) likeBook (...)  }
```
