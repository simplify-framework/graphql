# graphql-serverless
Boilerplate for GraphQL server running on serverless architecture

**listBookFunction()**
```Javascript
'use strict';

module.exports.handler = function(event, context, callback) {
    callback(null, [{
        title: "First Book",
        author: {
            id: "1234567891",
            name: "Cuong"
        }
    }, {
        title: "Second Book",
        author: {
            id: "1234567890",
            name: "Duong"
        }
    }])
}
```
**doneNewBook()**
```Javascript
'use strict';

module.exports.handler = function(event, context, callback) {
    event.args.author.id = "1234567892"
    callback(null, [{
        title: "First Book",
        author: {
            id: "1234567891",
            name: "Cuong"
        }
    }, {
        title: "Second Book",
        author: {
            id: "1234567890",
            name: "Duong"
        }
    }, { ...event.args }])
}
```


```GraphQL
# Write your query or mutation here
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
  addBook(title: "Fox in Socks", author: { name: "Dr. Seuss" }) {
    title
    author {
      id
      name
    }
  }
}
```