# Immich automatic Person -> Album

Automatically add people (faces) to an album and keep that album up-to-date. You can then share that automatic person-album 
with another user (for example, a shared album of your children).

You can arbitrarily add any face/person to any album. So you could make a "Family" album which contains all your family 
members and is automatically updated.

Each album can match people with `AND` logic (for example, only photos with both of your children together) or `OR`
logic (photos with any of them). You can also exclude people, or only allow photos with nobody else in them.

You can use API keys from any number of Immich users, so the one Docker container can handle doing automatic
albums for all your users.

**Requires Immich v3.2 or later.** If you are on an older Immich server, use image tag `1.0.2`.

## Setup

Take a copy of the [docker-compose.yml](https://github.com/alangrainger/immich-person-to-album/blob/main/docker-compose.yml) file.

```yaml
services:
  immich-person-to-album:
    image: alangrainger/immich-person-to-album:latest
    restart: always
    volumes:
      - ./config.json:/data/config.json:ro
```

There are two methods for specifying the config options:

### Configure via `config.json` file

1. Next to your `docker-compose.yml` file, put a copy of [config.json](https://github.com/alangrainger/immich-person-to-album/blob/main/data/config.json.example).
2. Edit the `config.json` file as required.

### ...or via Inline configuration

Alternatively, you can add the configuration inline in your `docker-compose.yml` file instead of the `volumes` section, like this:

```yaml
    environment:
      CONFIG: |
        {
          "immichServer": "http://192.168.0.20:2283",
          "schedule": "*/30 * * * *",
          "users": [
            {
              "apiKey": "XXXXXXXXXX",       # Immich user's API key (read-only access)
              "personLinks": [
                {
                  "description": "Joe and Anna together",
                  "albumId": "ZZZZZZZZZZ",                    # Shared album ID
                  "personIds": ["YYYYYYYYYY", "WWWWWWWWWW"],  # Joe's and Anna's person IDs
                  "logic": "AND",
                  "noOtherPeople": true
                }
              ]
            }
          ]
        }
```

### Person link options

| Field | Required | Default | Meaning |
|---|---|---|---|
| `albumId` | Yes | | The album to add photos to. |
| `personIds` | Yes | | A list of one or more person IDs. |
| `logic` | With 2+ people | | `AND` needs every person in the photo. `OR` needs at least one of them. Required when `personIds` has more than one person. |
| `excludePersonIds` | No | `[]` | Photos containing any of these people are not added. |
| `noOtherPeople` | No | `false` | When `true`, photos containing anyone not in `personIds` are not added. |
| `removeUnmatched` | No | `false` | When `true`, photos that no longer match are removed from the album. See below. |
| `description` | No | | Text shown in the log. |

- The old single `personId` field still works.
- You can point two links at the same album to combine different rules.
- `noOtherPeople` only counts faces that have been assigned to a person. Unnamed faces and hidden people do not block a photo.
- Photos are only ever added to an album, never removed, unless you set `removeUnmatched`.

### Removing photos that no longer match

Set `"removeUnmatched": true` on a link to keep its album in sync. This is useful after you fix a wrongly tagged face.

- The API key also needs the `albumAsset.delete` and `user.read` permissions. `user.read` is used to find out which
  user the API key belongs to, so that photos added to the album by other users are left alone.
- **Any of your photos in the album that do not match the link are removed, including photos you added by hand.**
  Comments and likes on a removed photo may be lost.
- Photos that other users added to a shared album are never removed.
- If several links point at the same album, a photo is removed only when it matches none of them.
- If a person ID in the album's links has no photos at all (for example, after you merge two people), nothing is
  removed and a warning is logged. Fix the person ID in your config.
- Photos that only fail the `noOtherPeople` check are not removed.

### Create an API key

1. Open Immich on desktop
2. Click on your profile picture
3. Click **Account Settings**
4. Go to API Keys
5. Click **New API Key**
6. Give it a name
7. Add the permissions of `asset.read` and `albumAsset.create` (plus `albumAsset.delete` and `user.read` if you use `removeUnmatched`)
8. Click **Create**
9. Copy the new API key and put it in your config file 

### Get your person and album IDs

Person IDs: 

- Immich → Explore → People → Click person → Copy ID from URL
- Example URL: http://your-server/people/f3437c84-83f9-4e84-9640-0dcd12efd08e
- Person ID: f3437c84-83f9-4e84-9640-0dcd12efd08e

Album IDs:

- Immich → Albums → Click album → Copy ID from URL
- Example URL: http://your-server/albums/ff85e8c5-32e6-49e0-a0ad-e4dd7ef66bce
- Album ID: ff85e8c5-32e6-49e0-a0ad-e4dd7ef66bce

## Troubleshooting

Make sure you can access your Immich API from inside the `immich-person-to-album` container. Run this command from outside the container, making sure to replace the address with your Immich server address:

```bash
docker exec immich-person-to-album sh -c "wget -qO- http://192.168.0.20:2283/api/server/ping"
```

It will return `{"res":"pong"}` if Immich is accessible to the `immich-person-to-album` container.

## Acknowledgements

Thanks to https://github.com/ajb3932/immich-partner-sharing for the idea and for some of the readme text.

The only reason for making this project is that at time of release, the above project [hadn't been updated](https://github.com/ajb3932/immich-partner-sharing/issues/4) to support Immich 2.x.
