import { db } from "@db";
import { users } from "@db/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createTestUser() {
  try {
    const hashedPassword = await hashPassword("testpass123");
    
    await db.insert(users).values({
      username: "testuser",
      password: hashedPassword,
      role: "user"
    });
    
    console.log("Test user created successfully");
  } catch (error) {
    console.error("Error creating test user:", error);
  }
}

createTestUser();
