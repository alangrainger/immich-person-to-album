# Immich automatic Person -> Album

Automatically add people to an album and keep that album up-to-date.

This allows you to share that automatic person album with another user (for example, a share album of your children).

You can arbitrarily add any face/person to any album. So you could make a "Family" album which contains all your family members and is automatically updated.

## Setup

### Docker-compose configuration

Take a copy of the [docker-compose.yml](https://github.com/alangrainger/immich-person-to-album/blob/main/docker-compose.yml) file.

There are two methods for specifying the config options:

#### `config.json` file

1. In the folder which contains your `docker-compose.yml` file, create a `/data/` folder.
2. Inside the `data` folder, put a copy of [config.json](https://github.com/alangrainger/immich-person-to-album/blob/main/data/config.json.example).
3. Edit the `config.json` file as required.

#### Inline configuration

Alternatively, you can add the configuration inline in your `docker-compose.yml` file like this:

```yaml
services:
  immich-person-to-album:
    image: alangrainger/immich-person-to-album:latest
    container_name: immich-person-to-album
    restart: always
    volumes:
      - ./data:/data
    environment:
      CONFIG: |
        {
          "immichServer": "http://192.168.0.20:2283",
          "schedule": "*/30 * * * *",
          "users": [
            {
              "apiKey": "",
              "personLinks": [
                {
                  "description": "Photos of Joe",
                  "personId": "Joe's person ID",
                  "albumId": "Shared album ID"
                }
              ]
            }
          ]
        }
```

### Create an API key

1. Open Immich on desktop
2. Click on your profile picture
3. Click **Account Settings**
4. Go to API Keys
5. Click **New API Key**
6. Give it a name
7. Add the permissions of `asset.read` and `albumAsset.create`
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

## Acknowledgements

Thanks to https://github.com/ajb3932/immich-partner-sharing for the idea and for some of the readme text.
