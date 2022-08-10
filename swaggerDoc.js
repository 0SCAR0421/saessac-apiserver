const swaggerUi = require("swagger-ui-express")
const swaggereJsdoc = require("swagger-jsdoc")

const options = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      version: "1.2.1",
      title: "saessac api server",
      description:
        "saessac api server",
    },
    host : "34.168.215.145", // base-url
    basePath : "/" // base path
  },
  apis: ["./server.js"], //Swagger 파일 연동
}
const specs = swaggereJsdoc(options)

module.exports = { swaggerUi, specs }