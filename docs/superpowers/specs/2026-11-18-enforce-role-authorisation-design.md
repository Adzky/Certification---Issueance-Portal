# Enforcing role authorisation design

## Intent

Close the two access-control gaps found in the final branch review: expired authorisations must not be usable, and inactive assignments must not read scoped records. Deployment advice is a response-only deliverable; this design does not add provider-specific configuration.

## Approaches

- **Central validity check (chosen):** define current assignment validity once and apply it to login eligibility, API session resolution, action permissions, and scoped reads. Keep `loadActor` able to report inactive assignment details for administration and tests.
- **Request-handler-only check:** reject invalid assignments at the API boundary. This is small but leaves service permission and read helpers unsafe if reused outside that wrapper.
- **Make `loadActor` return null for every unusable assignment:** this would block requests, but changes its existing inspection semantics and still needs independent login filtering.

## Design

- An assignment is usable only when its status is `ACTIVE` or `RESTRICTED`, its optional start bound is not in the future, and its optional end bound has not passed. Bounds are inclusive instants; null bounds remain unbounded for legacy assignments.
- Login options and login submission reject assignments outside that validity window.
- Protected API requests reject unusable assignments as unauthenticated, including sessions whose assignment is suspended, revoked, pending, expired, or outside its dates.
- `GET /api/session` remains a self-status endpoint for a valid signed cookie; it may report the holder's inactive status but returns no permissions and does not expose scoped records.
- Domain permission checks and scoped-read helpers apply the same validity rule so bypassing the route wrapper cannot restore access.
- Preserve existing behavior for currently usable assignments and keep `loadActor` available to inspect inactive assignments.

## Constraints and non-goals

- No schema or provider migration.
- No automatic database status transition when an authorisation date passes; effective access is denied dynamically.
- No deployment code or paid-service requirement; final deployment steps will call out persistence limitations of free hosting.

## Verification

Add focused coverage for future/expired bounds, login filtering, rejected sessions, and denied scoped reads; run the affected tests and the complete test suite.
