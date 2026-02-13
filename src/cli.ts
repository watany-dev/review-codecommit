#!/usr/bin/env node
import { greet } from "./index.js";

const name = process.argv[2] ?? "world";
console.log(greet(name));
