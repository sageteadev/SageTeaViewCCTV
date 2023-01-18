#!/bin/sh
cd /home/Shinobi/plugins/deepstack-object
if [ ! -e "./conf.json" ]; then
    echo "Creating conf.json"
    sudo cp conf.sample.json conf.json
else
    echo "conf.json already exists..."
fi

if [ -n "$ADD_CONFIG" ]; then
  echo ""
else
  ADD_CONFIG="{}"
fi
node ./modifyConfigurationForPlugin.js deepstack-face addToConfig=$ADD_CONFIG maxRetryConnection=100

# Execute Command
echo "Starting $PLUGIN_NAME plugin for Shinobi ..."
exec "$@"
