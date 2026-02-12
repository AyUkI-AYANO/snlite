# Locale Plugin Guide (v7.1.1)

SNLite supports locale plugins via Python entry points.

## Entry point group

Use `snlite.locales`.

## Minimal plugin format

Your entry function should return a mapping:

```python
{
  "code": "fr",
  "name": "Français",
  "messages": {
    "ui.language": "Langue",
    "ui.primary": "Primary",
    "ui.secondary": "Secondary",
    "status.idle": "Inactif"
  }
}
```

- `code`: locale code, e.g. `fr`, `ja`, `zh-TW`.
- `name`: label shown in language selector.
- `messages`: key-value overrides.

Plugin messages are merged onto built-in locales by code.

## Example (`pyproject.toml`)

```toml
[project.entry-points."snlite.locales"]
my_fr = "my_pkg.locale_fr:plugin_entry"
```

## Runtime controls

- `SNLITE_LOCALE_PLUGINS="*"` allow all (default)
- `SNLITE_LOCALE_PLUGINS="my_fr,custom_ja"` allow selected plugins

## Diagnostics API

- `GET /api/i18n/locales`

Returns loaded locales and plugin load status.
