# Community Avatars

This folder contains the source images for community avatars, organized by type.

## Folder Structure

```
community_avatars/
├── countries/      # Country & region community avatars (e.g., India, Pakistan)
└── colleges/       # College & university community avatars (e.g., Queens College)
```

## How to Add a New Avatar

1. Place the image file in the appropriate sub-folder:
   - **Country/Region** → `community_avatars/countries/<country_key>.png`
   - **College/University** → `community_avatars/colleges/<college_key>.png`

2. Add an entry to `uploadCommunityAvatars.js`:
   ```js
   {
     localFile: path.join(__dirname, 'community_avatars/colleges/baruch.png'),
     cloudinaryFolder: 'community_avatars/colleges',
     publicId: 'baruch',
     matchBy: { name: 'baruch college' },  // Must match community name in DB
   }
   ```

3. Run the upload script from the `backend/` directory:
   ```bash
   node uploadCommunityAvatars.js
   ```

4. The script will:
   - Upload the image to Cloudinary under `community_avatars/colleges/baruch`
   - Update the `Community.imageUrl` field in the database
   - The mobile app will show the new avatar on the next pull-to-refresh

## Cloudinary Folder Structure

```
community_avatars/
├── countries/
│   └── india           ← India (country/religion communities)
└── colleges/
    └── queens_college  ← Queens College (CUNY)
```

## Notes
- Images are automatically optimized by Cloudinary (WebP/AVIF, max 512x512)
- The app caches community data locally. A pull-to-refresh will load the new avatar.
- The `imageUrl` field in the `Community` table stores the Cloudinary URL.
