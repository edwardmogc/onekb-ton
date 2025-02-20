import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// 创建一个通用的日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

// 错误日志的旋转配置
const errorTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,          // 压缩旧的日志文件
  maxSize: '20m',               // 单个日志文件的最大大小
  maxFiles: '14d',              // 保留最近14天的日志
  level: 'error',
});

// 所有日志的旋转配置
const combinedTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'info',                // 捕获 'info' 及以上级别的日志
});

// 异常日志的旋转配置
const exceptionTransport = new DailyRotateFile({
  filename: 'logs/exceptions-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    errorTransport,
    combinedTransport,
  ],
  exceptionHandlers: [
    exceptionTransport,
  ],
  rejectionHandlers: [
    exceptionTransport, // 捕获未处理的 Promise 拒绝
  ],
  exitOnError: false, // 不在捕获到异常后退出进程
});

export default logger;