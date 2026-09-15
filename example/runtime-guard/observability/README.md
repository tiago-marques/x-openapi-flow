# Runtime Guard Observability Demo

Wires the runtime guard's `onDecision` hook to [`prom-client`](https://github.com/siimon/prom-client) so every
allowed/denied lifecycle decision becomes a Prometheus metric, ready to scrape or plug into a Grafana dashboard.

## Run

```bash
npm install
npm run start
```

Server listens on `http://localhost:3120`.

## Try it

```bash
# 1. Create an order (allowed initial state)
curl -s -X POST http://localhost:3120/orders

# 2. Try to ship before paying (blocked -> denied_invalid_transition)
curl -i -X POST http://localhost:3120/orders/<id>/ship

# 3. Pay it (allowed_transition), then ship (allowed_transition)
curl -s -X POST http://localhost:3120/orders/<id>/pay
curl -s -X POST http://localhost:3120/orders/<id>/ship

# 4. Inspect the metrics
curl -s http://localhost:3120/metrics | grep x_openapi_flow
```

Expected metrics:

```
# HELP x_openapi_flow_decisions_total Runtime guard decisions, labeled by outcome and operation.
# TYPE x_openapi_flow_decisions_total counter
x_openapi_flow_decisions_total{decision="allowed_initial_state",operation_id="createOrder",method="POST"} 1
x_openapi_flow_decisions_total{decision="denied_invalid_transition",operation_id="shipOrder",method="POST"} 1
x_openapi_flow_decisions_total{decision="allowed_transition",operation_id="payOrder",method="POST"} 1
x_openapi_flow_decisions_total{decision="allowed_transition",operation_id="shipOrder",method="POST"} 1

# HELP x_openapi_flow_decision_duration_ms Time spent evaluating a runtime guard decision, in milliseconds.
# TYPE x_openapi_flow_decision_duration_ms histogram
...
```

## How it works

`createExpressFlowGuard` accepts an `onDecision(event)` callback that fires for every enforced request,
regardless of outcome (`allowed_transition`, `denied_invalid_transition`, `allowed_initial_state`, etc.) —
see [`lib/runtime-guard/core.js`](../../../x-openapi-flow/lib/runtime-guard/core.js). This demo increments a
`Counter` per `(decision, operation_id, method)` and observes a `Histogram` of decision latency, then exposes
both through a standard `/metrics` endpoint that any Prometheus server can scrape.

Swap the `prom-client` calls in `server.js` for an OpenTelemetry `Meter` if you'd rather export via OTLP —
the shape of the `onDecision` event stays the same.
