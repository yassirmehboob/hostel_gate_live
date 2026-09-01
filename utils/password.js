import bcrypt from "bcrypt";

const rounds = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
