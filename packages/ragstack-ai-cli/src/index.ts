#!/usr/bin/env node
import {main} from "./cli.js";

const handleSigTerm = () => process.exit(0)
const onError = () => process.exit(1)
main({handleSigTerm, onError})
