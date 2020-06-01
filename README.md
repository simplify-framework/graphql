# Simplify Framework - GraphQL 

A GraphQL Serverless Architecture Model (GSAM) - Base on amazing [Appollo GraphQL](https://www.apollographql.com/) server project. We help you generating a boilerplate GraphQL based project that immediately can deploy on AWS Lambda function behind an API Gateway as a serverless model. What do you think? You can design GraphQL resolvers as a State Machine (aka AWS Step Functions) inside your project.

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

    * Follow these commands to walk throught your project: (starwars)

    1. Setup AWS Account   : bash .simplify-graphql/aws-setup.sh 
    2. Goto Project Dir    : cd ./ 
    3. Install Packages    : npm install 
    4. Deploy AWS Stacks   : npm run stack-deploy 
    5. Push Code Functions : npm run push-code 
    6. Update Environments : npm run push-update 
    7. Test Your Functions : npm run test 
    8. Destroy AWS Stacks  : npm run stack-destroy 
    9. Cleanup AWS Account : bash .simplify-graphql/aws-cleanup.sh 

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
