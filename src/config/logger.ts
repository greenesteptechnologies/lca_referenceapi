import winston from "winston";
import fs from "fs";
import path from "path";
import DailyRotateFile from "winston-daily-rotate-file";
import { ENV } from "./env";

const isProduction = ENV.NODE_ENV === "production";


// DATE-WISE LOG FOLDER
const today = new Date().toISOString().split("T")[0];

const baseLogDir =
  ENV.LOG_DIR ||
  (isProduction
    ? "/var/log/lca_reference_api"
    : path.join(process.cwd(), "logs"));

const logDir = path.join(baseLogDir, today);


// CREATE DIRECTORY IF NOT EXISTS
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}


// LOG FORMAT
const consoleFormat = winston.format.printf(
  ({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  }
);


// LOGGER
export const logger = winston.createLogger({
  level: ENV.LOG_LEVEL || (isProduction ? "info" : "debug"),

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),

  transports: [
    // APPLICATION LOG
    new DailyRotateFile({
      filename: path.join(logDir, "application-%DATE%.log"),

      datePattern: "YYYY-MM-DD",

      maxSize: "20m",

      maxFiles: ENV.LOG_MAX_DAYS || "30d",

      zippedArchive: true,
    }),

    // ERROR LOG
    new DailyRotateFile({
      filename: path.join(logDir, "error-%DATE%.log"),

      level: "error",

      datePattern: "YYYY-MM-DD",

      maxSize: "20m",

      maxFiles: ENV.LOG_MAX_DAYS || "30d",

      zippedArchive: true,
    }),

    // CONSOLE ONLY FOR DEV
    ...(!isProduction || ENV.LOG_TO_CONSOLE === "true"
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp(),
              consoleFormat
            ),
          }),
        ]
      : []),
  ],

  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, "exceptions-%DATE%.log"),

      datePattern: "YYYY-MM-DD",

      maxFiles: ENV.LOG_MAX_DAYS || "30d",
    }),
  ],

  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, "rejections-%DATE%.log"),

      datePattern: "YYYY-MM-DD",

      maxFiles: ENV.LOG_MAX_DAYS || "30d",
    }),
  ],

  exitOnError: false,
});


// ======================================================
// OPTIONAL CONSOLE OVERRIDE
// ======================================================

console.log = (...args) => logger.info(args.join(" "));
console.info = (...args) => logger.info(args.join(" "));
console.warn = (...args) => logger.warn(args.join(" "));
console.error = (...args) => logger.error(args.join(" "));