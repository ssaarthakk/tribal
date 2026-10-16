#!/usr/bin/env bash
set -eu

prettier --write .
eslint --fix .
