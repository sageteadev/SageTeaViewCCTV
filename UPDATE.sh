#!/bin/bash
distro=$1
repo=$2
if [ -z "$distro" ]; then 
    distro='master'
fi
if [ -z "$repo" ]; then 
    repo='SageteaViewCCTV'
fi
if [ "$repo" = "SageteaViewCCTV" ]; then
    productName="SageteaViewCCTV Professional (Pro)"
else
    productName="SageteaViewCCTV Community Editon (CE)"
fi
git reset --hard
git pull
gitURL="https://github.com/sageteadev/SageTeaViewCCTV"
gitVersionNumber=$(git rev-parse HEAD)
theDateRightNow=$(date)
rm version.json
touch version.json
chmod 755 version.json
echo '{"Product" : "'"$productName"'" , "Branch" : "'"$distro"'" , "Version" : "'"$gitVersionNumber"'" , "Date" : "'"$theDateRightNow"'" , "Repository" : "'"$gitURL"'"}' > version.json
echo "Restart SageTeaViewCCTV for updates to take effect."