# India districts seed data

Place one JSON file per Indian state/UT using the state `code` from `src/data/states_IN.json`.

## File naming

- `src/data/districts_IN/<STATE_CODE>.json`

Examples:
- `src/data/districts_IN/TG.json`
- `src/data/districts_IN/AP.json`
- `src/data/districts_IN/DL.json`

## JSON format

Array of objects:

```json
[
  { "name": "Hyderabad" },
  { "name": "Ranga Reddy" }
]
```

Only `name` is required.

## Notes

- Seeder will create districts for a state only if the matching file exists.
- For backward compatibility, Telangana can also be provided via `src/data/districts_TG.json`.
