#!/bin/bash
# Launcher used by supervisor's frontend program to run the Texxel Next.js app.
cd /app/texxel
exec ./node_modules/.bin/next dev --webpack -H 0.0.0.0 -p 3000
