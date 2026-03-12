#!/bin/bash
docker rm -f martin 2>/dev/null

docker run -d --name martin -p 3000:3000 --platform linux/amd64 \
  -v /Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/backend/martin.yaml:/config/martin.yaml \
  -v /Users/naveendevapalan/Desktop/Naveen/PROJECTS/eAIP/backend/data:/data \
  maplibre/martin --config /config/martin.yaml

sleep 2
docker logs martin
