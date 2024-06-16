# Use an official Node.js runtime as a parent image
FROM node:20.14

# Set the working directory in the container
WORKDIR /app

# Install dependencies
RUN yarn 

# Default command to run when starting the container
CMD [ "yarn", "start" ]
