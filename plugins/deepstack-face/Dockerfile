FROM node:16.13-buster-slim

RUN apt update -y
RUN apt install wget curl net-tools -y

RUN mkdir -p /config
RUN mkdir -p /home/Shinobi/plugins/deepstack-face
WORKDIR /home/Shinobi/plugins/deepstack-face

COPY . /home/Shinobi/plugins/deepstack-face
RUN wget https://gitlab.com/Shinobi-Systems/Shinobi/-/raw/dev/plugins/pluginBase.js -O /home/Shinobi/plugins/deepstack-face/pluginBase.js
RUN wget https://gitlab.com/Shinobi-Systems/Shinobi/-/raw/dev/tools/modifyConfigurationForPlugin.js -O /home/Shinobi/plugins/deepstack-face/modifyConfigurationForPlugin.js
RUN wget https://gitlab.com/Shinobi-Systems/Shinobi/-/raw/dev/plugins/pluginCheck.js -O /home/Shinobi/plugins/pluginCheck.js
RUN ls /home/Shinobi/plugins/deepstack-face

RUN apt install -y sudo dos2unix

RUN npm install pm2 -g

RUN npm install --unsafe-perm

RUN dos2unix /home/Shinobi/plugins/deepstack-face/init.sh
RUN dos2unix /home/Shinobi/plugins/deepstack-face/pm2.yml
RUN chmod -f +x /home/Shinobi/plugins/deepstack-face/init.sh
RUN chmod -f +x /home/Shinobi/plugins/deepstack-face/pm2.yml

EXPOSE 8082

ENTRYPOINT ["/home/Shinobi/plugins/deepstack-face/init.sh"]

CMD [ "pm2-docker", "/home/Shinobi/plugins/deepstack-face/pm2.yml" ]
