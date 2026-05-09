import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "LCA Service API",
      version: "1.0.0",
    },
  },
  apis: [
    path.join(__dirname, "../../swagger.yaml"),
    path.join(__dirname, "../routes/**/*.ts"),
    path.join(__dirname, "../controllers/**/*.ts"),
  ],
});

export const swaggerServe = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(swaggerSpec);
