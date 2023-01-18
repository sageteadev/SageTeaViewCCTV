# Shinobi Video plugin for DeepStack / CodeProject AI Face Recognition

### How to Install plugin on GPU

> [This document has been rewritten over on ShinobiHub Articles.](https://hub.shinobi.video/articles/view/PcBtEgGuWuEL529)

# Docker Installation
> Install Shinobi Plugin with Docker

> Image is based on `node:12.22.1-buster-slim`.

1. Enter plugin directory. Default Shinobi installation location is `/home/Shinobi`.

```
cd /home/Shinobi/plugins/deepstack-face
```

2. Build Image.

```
docker build --tag shinobi-deepstack-face-image:1.0 .
```

3. Launch the plugin.

- `-e ADD_CONFIG='{"key":"123mypluginkey","host":"172.16.100.238","port":8080,"deepStack":{"host":"172.16.100.238","port":5000,"isSSL":false,"apiKey":"123"}}'` Adds any configuration parameters to the plugin's conf.json file.
- `-p '8082:8082/tcp'` is an optional flag if you decide to run the plugin in host mode.

```
docker run -d --name='shinobi-deepstack-face' -e ADD_CONFIG='{"key":"123mypluginkey","host":"172.16.100.238","port":8080,"deepStack":{"host":"172.16.100.238","port":5000,"isSSL":false,"apiKey":"123"}}' shinobi-deepstack-face-image:1.0
```

** Logs **

```
docker logs /shinobi-deepstack-face
```

** Stop and Remove **

```
docker stop /shinobi-deepstack-face && docker rm /shinobi-deepstack-face
```

### Options (Environment Variables)

| Option           | Description                                                                                                                                                                                               | Default    |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------|
| ADD_CONFIG      | The plugin's name.                                                                                                                                                                                        | DeepStack-Face |


# Additional Information

Docker - [Get docker](https://docs.docker.com/get-docker/)

DeepStack - [Getting started](https://docs.deepstack.cc/getting-started/index.html#setting-up-deepstack)

Run DeepStack CPU docker image:
```
sudo docker run -e VISION-FACE=True -e VISION-DETECTION=True -v localstorage:/datastore -p 80:5000 deepquestai/deepstack
```

GPU [installation guide](https://docs.deepstack.cc/using-deepstack-with-nvidia-gpus/#step-1-install-docker)

#### More installation options
[Windows (CPU / GPU support)](https://docs.deepstack.cc/windows/index.html)

[nVidia Jetson](https://docs.deepstack.cc/nvidia-jetson/index.html#using-deepstack-with-nvidia-jetson)

[Raspberry PI](https://docs.deepstack.cc/raspberry-pi/index.html#using-deepstack-on-raspberry-pi-alpha)
