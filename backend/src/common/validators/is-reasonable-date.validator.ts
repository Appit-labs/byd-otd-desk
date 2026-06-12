import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isReasonableDate', async: false })
export class IsReasonableDateConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;

    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return false;

      const year = date.getUTCFullYear();
      // Accept dates from 2020 to 2100
      return year >= 2020 && year <= 2100;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'createdAt must be a valid date between years 2020 and 2100';
  }
}

export function IsReasonableDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsReasonableDateConstraint,
    });
  };
}
