#!/usr/bin/env sh
set -eu

docker build -f docker/Dockerfile.node -t codesight-node-runner .
docker build -f docker/Dockerfile.python -t codesight-python-runner .
docker build -f docker/Dockerfile.cpp -t codesight-cpp-runner .
docker build -f docker/Dockerfile.java -t codesight-java-runner .
