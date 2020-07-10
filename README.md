# Simplify Framework - GraphQL 

A GraphQL Serverless Architecture Model (GSAM) - Base on amazing [Apollo GraphQL](https://www.apollographql.com/) server project. We help you generating a boilerplate GraphQL based project that immediately can deploy on AWS Lambda function behind an API Gateway as a serverless model. What do you think? You can design GraphQL resolvers as a State Machine (aka AWS Step Functions) inside your project.

![DevOps CI/CD](https://github.com/simplify-framework/graphql/workflows/DevOps%20CI/CD/badge.svg)
![NPM Downloads](https://img.shields.io/npm/dw/simplify-graphql)
![Package Version](https://img.shields.io/github/package-json/v/simplify-framework/graphql?color=green)

## Setup your AWS Master Credential

Goto [AWS Setup Credentials](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html) then create an account to be used to provision a secure Github credentials. The root credentials must have the following permissions to configure your `deployment account` user with least privilege policy. It must has these permissions:
	+ iam:CreateUser
	+ iam:CreateRole
	+ iam:PutUserPolicy
	+ iam:PutRolePolicy
		
## HOW TO: Build a GraphQL project:
- `npm install -g simplify-graphql`
- `simplify-graphql -i schema.graphql`

> It will help you to create your project step by step...

    ╓───────────────────────────────────────────────────────────────╖
    ║               Simplify Framework  - GraphQL                   ║
    ╙───────────────────────────────────────────────────────────────╜
    - Automatic code merge is off (use option --merge to turn on)
    - Diff file generation is off (use option --diff to turn on)

    - What is your Project name? starwars
    - What is your Project description? This is a new starwars III
    - What is your Project Id? (aa405d57a6f189b2): [Enter]
    - Choose your Deployment Bucket? (starwars-deployment-eu-west-1): 
    - Choose your Deployment Region? (eu-west-1): [Enter]
    - Create new Deployment Profile? (simplify-eu): [Enter]
    - What is your AWS Account Id? **your_aws_account_id**
    - Do you want to use Secret Manager as KeyVault? [y/n]: n
    - What is your Endpoint ApiKey? (a4d0c3836b6ab16ece5cabf1887128ff6bddf962): [Enter]
    - Finish code generation with NO error. See current folder for your code!

    * Follow these commands to walk throught your project: (MyStarWars)

   1. Setup AWS Account         : npm run setup-account 
   2. Install Packages          : npm install 
   3. Deploy AWS Stacks         : npm run stack-deploy 
   4. Push Code Functions       : npm run push-code 
   5. Run your test specs       : npm run test 
   6. Update Environments       : npm run push-update 
   7. Monitor Metrics           : npm run monitor-metric 
   8. Destroy AWS Stacks        : npm run stack-destroy 
   9. Cleanup AWS Account       : npm run cleanup-account 

## Security & Operation commands

    1. npm run monitor-metric   --displaying operation metrics: Invocations, Errors, Durations, Concurrency, Throttles
    2. npm run monitor-config   --displaying configurations: CodeSize, MemorySize, Timeout, Runtime, LastModified
    3. npm run security-check   --checking for consistency: check code function hash, code layers' hashes, security setup
    4. npm run security-patch   --patching for secure encryption: secure function environment, secure log with KMS CMK
    5. npm run take-snapshot    --recording for consistency: save code function hash, code layers' hashes and configuration

    See [Simplify SecOps](https://github.com/simplify-framework/security) for detail commands and optionnal parameters...

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
            name
        }
    }
}`

let GetBooksAndAuthors = {
    "operationName": "GetBooksAndAuthors",
    "variables": {},
    "query": Queries
}

fetch("https://y5m4j8o1v5.execute-api.eu-west-1.amazonaws.com/demo/book/user", {
    "headers": {
        "content-type": "application/json"
    },
    "body": JSON.stringify(GetBooksAndAuthors),
    "method": "POST",
    "mode": "cors"
}).then(response => response.json()).then(json => console.log(json));
```

## Using CURL with local development server

curl -X POST -d '{ "operationName": "GetBooksAndAuthors", "variables": {}, "query": "query GetBooksAndAuthors { listBooks { title } }"}' -H 'content-type:application/json' http://localhost:4000/graphql

## The StarWars Verbal Architecture Model
```
### Verbal Architecture Design - GSAM ###
### Copyright@2020 Simplify Framework ###

* @GraphQLServer Name=StarwarServerQuery run on LAMBDA
    FOR EVERY (Query)
        POST /query using NONE authorization with ApiKey=false
            listBooks [StarwarServerQuery=GraphQLEndpoint, ] => ListType() will execute @GraphQLResolver=listBookFunction
            getBook [title=String] => NamedType() will execute @GraphQLResolverSet=getBookFunction
                    Function=checkBookExisted() onSuccess=getExistingBook() onFailure=doneGetBook() RetryOnFailure=3
                    Function=getExistingBook() onSuccess=doneGetBook() onFailure=ERROR() RetryOnFailure=
                    Function=doneGetBook() onSuccess=DONE() onFailure=ERROR() RetryOnFailure=
        * StarWarsBookCacheSpace HAS KEY=id AND INDEX=author
    
* @GraphQLServer Name=StarwarServerMutation run on LAMBDA
    FOR EVERY (Mutation)
        POST /book/admin using SIGV4 authorization with ApiKey=false
            addBook [title=String, author=AuthorInput] => ListType() will execute @GraphQLResolverSet=addBookFunctionSet
                    Function=checkBookExisted() onSuccess=addNewBook() onFailure=doneNewBook() RetryOnFailure=3
                    Function=addNewBook() onSuccess=doneNewBook() onFailure=errorNewBook() RetryOnFailure=
                    Function=doneNewBook() onSuccess=DONE() onFailure=ERROR() RetryOnFailure=
                    Function=errorNewBook() onSuccess=DONE() onFailure=ERROR() RetryOnFailure=
            deleteBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=deleteBookFunction
        POST /book/user using COGNITO authorization with ApiKey=false
            readBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=readBookFunction
                    Method=checkBookPaid() onSuccess=readNewBook() onFailure=errorPaidBook() RetryOnFailure=
                    Method=readNewBook() onSuccess=doneReadBook() onFailure=ERROR() RetryOnFailure=
                    Method=doneReadBook() onSuccess=DONE() onFailure=ERROR() RetryOnFailure=
                    Method=errorPaidBook() onSuccess=DONE() onFailure=ERROR() RetryOnFailure=
            likeBook [title=String, author=AuthorInput] => NamedType() will execute @GraphQLResolver=likeBookFunction
        * StarWarsBookTable HAS KEY=id AND INDEX=author
        * StarWarsAuthorTable HAS KEY=id AND INDEX=name
    


* [Query] connects to DataSource=CASSANDRA @alias=StarWarsQuery has Tables=StarWarsBookCache[:id #author]
* [Mutation] connects to DataSource=DYNAMODB @alias=StarWarsMutation has Tables=StarWarsBook[:id #author],StarWarsAuthor[:id #name]

* [DataInput] AuthorInput { name=[object Object], type=[object Object]  }

* [EnumObject] AuthorType { JOURNALIST, SCIENTIST  }

* [DataObject] Book { id=[object Object], title=[object Object], author=[object Object], subauthor=[object Object], comments=[object Object], outofstock=[object Object], types=[object Object], createdDate=[object Object], updatedDate=[object Object]  }
* [DataObject] NestBook { name=[object Object], id=[object Object]  }
* [DataObject] Author { id=[object Object], name=[object Object], type=[object Object], ref=[object Object]  }
- [DataObject] Query { listBooks (...) getBook (...)  }
- [DataObject] Mutation { addBook (...) deleteBook (...) readBook (...) likeBook (...)  }

```

## MyStarWars on AWS Stack CloudFormation Design

![MyStarWars](https://github.com/simplify-framework/graphql/blob/1a36f73c4e2d9c256b40dca622a3a46248bf843a/templates/cfn-designer.png?raw=true)