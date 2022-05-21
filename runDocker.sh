#!/bin/sh

cd /Users/patrick/Dev/portfolio-landing-page

docker stop portfolio
docker rm portfolio
docker image rm portfolio

docker build -t portfolio
docker run -d -p 3000:3000 --name portfolio portfolio
