export type PaymentMethod = "card" | "cod";

export type CheckoutValues = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  cardName: string;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutValues, string>>;

// Order matters: the first failing field in this list gets focus on submit.
export const fieldOrder: (keyof CheckoutValues)[] = [
  "email",
  "phone",
  "firstName",
  "lastName",
  "line1",
  "line2",
  "city",
  "region",
  "postal",
  "country",
  "cardNumber",
  "cardExpiry",
  "cardCvc",
  "cardName",
];

export const countries = [
  "United States",
  "Pakistan",
  "United Kingdom",
  "Canada",
  "United Arab Emirates",
  "Germany",
];

const digits = (s: string) => s.replace(/\D/g, "");

export const formatCardNumber = (s: string) =>
  digits(s).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

export const formatExpiry = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const luhn = (num: string) => {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let n = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
};

export function validateField(
  name: keyof CheckoutValues,
  values: CheckoutValues,
  method: PaymentMethod,
): string | undefined {
  const v = values[name].trim();
  switch (name) {
    case "email":
      if (!v) return "Enter your email address.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email, like name@example.com.";
      return;
    case "phone":
      if (v && (digits(v).length < 7 || digits(v).length > 15)) return "Enter a valid phone number.";
      return;
    case "firstName":
      return v ? undefined : "Enter your first name.";
    case "lastName":
      return v ? undefined : "Enter your last name.";
    case "line1":
      return v ? undefined : "Enter your street address.";
    case "city":
      return v ? undefined : "Enter your city.";
    case "region":
      return v ? undefined : "Enter your state or province.";
    case "postal":
      if (!v) return "Enter your postal code.";
      if (!/^[A-Za-z0-9 -]{3,10}$/.test(v)) return "Enter a valid postal code.";
      return;
    case "country":
      return v ? undefined : "Choose a country.";
    case "cardNumber": {
      if (method !== "card") return;
      const d = digits(v);
      if (!d) return "Enter your card number.";
      if (d.length !== 16 || !luhn(d)) return "That card number is not valid.";
      return;
    }
    case "cardExpiry": {
      if (method !== "card") return;
      const match = /^(\d{2})\/(\d{2})$/.exec(v);
      if (!match) return "Enter the expiry as MM/YY.";
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      if (month < 1 || month > 12) return "Enter a month from 01 to 12.";
      const now = new Date();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      if (endOfMonth < now) return "This card has expired.";
      return;
    }
    case "cardCvc":
      if (method !== "card") return;
      return /^\d{3,4}$/.test(v) ? undefined : "Enter the 3 or 4 digit code.";
    case "cardName":
      if (method !== "card") return;
      return v ? undefined : "Enter the name on the card.";
    default:
      return;
  }
}

export function validateAll(values: CheckoutValues, method: PaymentMethod): CheckoutErrors {
  const errors: CheckoutErrors = {};
  for (const name of fieldOrder) {
    const error = validateField(name, values, method);
    if (error) errors[name] = error;
  }
  return errors;
}
