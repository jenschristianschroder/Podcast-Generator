import { validationResult } from 'express-validator';
import { ValidationError } from './errorHandler.js';

/**
 * Validation middleware using express-validator
 * Extracts validation errors and formats them consistently
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    const validationError = new ValidationError(
      'Request validation failed',
      formattedErrors
    );

    return next(validationError);
  }

  next();
};

export default validateRequest;
