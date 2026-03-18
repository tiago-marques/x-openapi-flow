# Runtime Guard Examples

This folder contains executable runtime enforcement examples for Node.js APIs.

Projects:

- express: request-time transition enforcement with Express middleware
- fastify: request-time transition enforcement with Fastify preHandler hook
- minimal-order: 5-minute e-commerce demo showing invalid shipment blocked at runtime

Both examples demonstrate:

1. Creating a payment resource in AUTHORIZED state
2. Blocking invalid capture when state is not AUTHORIZED
3. Returning explicit 409 error payload for invalid transitions

Quick start:

- cd into one project
- npm install
- npm run apply
- npm start
- run the curl commands from that project README

If you want the fastest proof, start with `minimal-order/` (no apply step required).
