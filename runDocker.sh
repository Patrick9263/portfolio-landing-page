#!/bin/sh

MAC_DIR="/Users/patrick/Dev/portfolio-landing-page"
WIN_DIR="~/Documents/Dev/portfolio-landing-page"

if [ -d $MAC_DIR ]; then
    echo "cd $MAC_DIR"
    cd $MAC_DIR
elif [ -d $WIN_DIR ]; then
    echo "cd $WIN_DIR"
    cd $WIN_DIR
else
    echo "Application directory doesn't exist"
    exit 9999
fi

printf "\nBuilding portfolio Docker image...\n\n"
docker stop portfolio
docker rm portfolio
docker image rm portfolio

docker build -t portfolio .
docker run -d -p 3000:3000 --name portfolio portfolio
