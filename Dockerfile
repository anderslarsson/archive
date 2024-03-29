FROM node:8-alpine
MAINTAINER denic 

# NOTE: "node" user and corresponding "/home/node" dir are created by "node:6-alpine" image.
WORKDIR /home/node/archive

RUN apk add --no-cache rsync curl

COPY . .
# Change owner since COPY/ADD assignes UID/GID 0 to all copied content.
RUN chown -R node:node . 

ENV NODE_ENV=development

# Set the user name or UID to use when running the image and for any RUN, CMD and ENTRYPOINT instructions that follow
USER node
RUN npm install

# Build client components
ARG CI="false"
RUN if $CI -eq "true"; then npm run build:client ; fi

# A container must expose a port if it wants to be registered in Consul by Registrator.
# The port is fed both to node express server and Consul => DRY principle is observed with ENV VAR.
# NOTE: a port can be any, not necessarily different from exposed ports of other containers.
EXPOSE 3031 

CMD [ "npm", "start" ]
HEALTHCHECK --interval=15s --timeout=3s --retries=12 \
  CMD curl --silent --fail http://localhost:3031/api/health/check || exit 1
