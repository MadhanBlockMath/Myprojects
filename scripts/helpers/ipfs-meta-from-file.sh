#!/bin/bash

# Takes the file passed in as an argument and:
#
# - pins it to IPFS
# - grabs the resulting hash
# - creates a metadata JSON blob with that hash (on ipfs.io gateway) as "image", and filename as "name", and pins that JSON blob to IPFS
# - returns the hash of the metadata JSON
#
# Requires a local IPFS node to be running - content is pinned with `ipfs add <file>`.

set -eo pipefail
shopt -s expand_aliases

if [ -z "$1" ]
then
    echo "Please pass in a file to pin to IPFS"
    exit
fi

# GATEWAY_URI="https://gateway.pinata.cloud/ipfs/"
GATEWAY_URI="https://ipfs.io/ipfs/"

image_hash=$(ipfs add -Q "$1")
image_uri=$GATEWAY_URI$image_hash

name=$(basename "$1")
name="${name%.*}"
name="${name//_/ }"

metadata="{\"name\":\"$name\",\"image\":\"$image_uri\"}"

echo "$metadata" | ipfs add -Q
