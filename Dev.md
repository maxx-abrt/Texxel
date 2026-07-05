Make sure this has been made (other ai started already) : 
You are pro dev full stack for 10 years, very high efficiency and intelligence. You are creative, innovative and you find new ways and approchaces to make intuitive apps, aesthetic and modern apps, which are also mobile first, responsive and very very much intuitive. You are efficient for coding, do not speak for nothing, low token usage and best optimisation for tokens and tools (best new edge and most recent tools, mcps, apis, libraries, etc...

Use the github repo at : https://github.com/maxx-abrt/Texxel.git

Use main branch

Here is pat you need, it is private :

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

Clone it, ensure at the end you push, commit and sync smoothly with user : maxaubert17@gmail.com and user : maxx.abrt

Organise as you want, you will have to add it all so ensure you use what you need and work as you wish.

If needed, here is the .env (with both postgre and convex dbs, there is already content so don't seed and don't truncate or remove things, you can change Dbs as you need for your features):
# Deployment used by `npx convex dev`
CONVEX_DEPLOYMENT=dev:dependable-butterfly-811 # team: max-aubert, project: thread

NEXT_PUBLIC_CONVEX_URL=https://dependable-butterfly-811.eu-west-1.convex.cloud

NEXT_PUBLIC_CONVEX_SITE_URL=https://dependable-butterfly-811.eu-west-1.convex.site

# Google Gemini API Key (primary — free tier: 15 RPM, 1M tokens/day)
# Get yours at https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaSyD5y8lHqQPAKCU_bwCFRlEy6GSQk1rT5AM

# AIML API Key for AI Assistant (fallback)
AIML_API_KEY=3541a12fbbf4d96c52183bfaa7e8bf36

CONVEX_DEPLOYMENT=https://dependable-butterfly-811.eu-west-1.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://dependable-butterfly-811.eu-west-1.convex.cloud

# Neon Auth
NEON_AUTH_BASE_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth
NEXT_PUBLIC_NEON_AUTH_BASE_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=noBIWRGsiras7vzsk6NWqEqSo8sds543!M69ZnCl9OLZMNuSW0=
NEON_AUTH_JWKS_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth/.well-known/jwks.json

# Neon PostgreSQL
DATABASE_URL=postgresql://neondb_owner:npg_dYLP4B9xEFwK@ep-gentle-field-al4zaz6h-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

EDGE_STORE_ACCESS_KEY=BNlXXsUqsjgpTOmk7T6iGNNa0tCybaep
EDGE_STORE_SECRET_KEY=nwQ9Ay9drWV3qa49piSRH4TlZzpU2Ds2wYMwOxKvZg15mJRb

# JWT Bridge (RS256 keys for Convex auth - bridges Neon Auth sessions to Convex)
CONVEX_AUTH_PRIVATE_KEY="LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRQ3g1RnUyb0JqbXIrTmQKVHBHZU9Id1VmNzlMOWN0ZEFYZTZkTkVJcHhsMHZQY1NKRXZNaVRzZm4rRUc1TmZnckg1dmtadmxWWTY3UERGaQoxbHJiWW9HcmplbXYrZlhscFB3cW9DbUtZR0VlSGFtdWxIWVhkcGV5ckhyb2ZybnJsa29QNHpoZ25UdjJFUFJ2CndlNzhBd1pHN2VUUWU1NVdmOUNnWmdpNytlMG5HYi9IVUt3emVuNTJSd0F4OHdkYU1zZUtNdVJ2b1NHNDRBbUYKbmhqRFdSZFYrR20vVWtkOEZvU0hsYk1yL21TVTQ3UWFUd2FBWFhEYnN1VUExa1BGY25JQk56ZkNsN0RKdCtKcgpqMEV1MTJJRXoyUmdCVE03LzRqNXJyNWc1MzkvRFdtZzlxMXdOdms2YVZjNEFFWk9KSDlsSWdacEdkQUdYNEVUCmFyM0dEOHFsQWdNQkFBRUNnZ0VBRDEwakpLWGdHMXNPaVNUN2c2THFQZFQ5L3hWUlJUZVd1OFpTQ3NGdjBUckUKSUtUU01tM3ZGWFNpbytIemc0YUhadmhpOHFRak5IMlJpd2FXQ0pqbk44WUZGdnRBMGJRZ1NVZ3E2UFlZL1MwSwpWaUhNQkl2QlgwcEdsVG80c1hyNTY0bXdJL3dBZCtpUDlwcFZHeDZNYTJkK3hHNGd4em9PYm9QOElNd0lQNVpLCkJNVzhTVC9kREdGY2xVakp2QWUrTnZieXJYc1JESFloamlPWmdFczQyK1ZuM05KeEx5QkpKMkZoOGwzR25LMGQKcVBNZ3hoQkFhQ2NNampjOUhEUDYxekN3M0hob01xL1FVTTJrcHZFUm5KamdiRjlITi9iTkxseGlIeldHMDVVNQowVFhQb0U0Y3d1VDJZWG5DeUhkMFhWTUR2WndLRXVlY3lkSmtpT1NGRXdLQmdRRGJMQ1lHRWdISjVCWXFuZUVTCjYwQ2J1cEZHNGVDWTZ6VU9PWEd6ZHlNbjAwZSswOGpxUDJGVFBJb1FJQXM3Rmxia1orM1NUTUphV3JVWFNDSFkKYzJrUFUwSnROcUFabzF6T0xmYitWOWxCMkVNOU5GcVJxOWNTWkF2UXpCdURydWtzT2paUUhjL1VZZUlHbDJFbgpEN0k3MmlTenZYNGNQaFhWTmVqcUxiZ01pd0tCZ1FEUHlJRUtQS0hFU3IzWHhkMW1ERFM2aU9qUVFnZGVRZCsvClRoVEI3aUFvcE1YVWtwYTZtYmExeWlTY1cxREhPUXZmYVNKcXR6Z2JaSk11OVVDUkw4OVBiMGlMVTBhL1hITEgKVXhLVFhYUkFqcnN3aDNTMUQ0Y1kwNHNwVFJTZVoyMlRHTTlFWTJYaHp6OGtBekM3QmM5SW1JeG1Yb1RXcmJjWgpveTg5RCs1N2p3S0JnUUNKbGdSa3FTY3dTeHZUTXZzWStrKzdzdm9DQ2tnSkZ4WmVVSmRjOXZ3OXd2ZDJCdE5JCm9mTUI0cTQxQXppcHBoTjBIUDRCbDZnbU9tMFdLWFQ5d1MyQnJsMnoyNmZUa0dieEU0L0xDUERjMGRzYjcrS3YKTWJXNDJNOUdDdXQyMWZXUWl4YVBZcmVWOXNDQ0xNT1RWdG9ua29DWnlPb0M1c0tqN3N6QlBXUWRrd0tCZ1FDbQp2ZEJQMXJnNlBZQjdWMTJFTnVkWmllVEt1eklPZ2U1OEpyeWhvK1pLdDIvS1ZwaCt4anZKUnA1Nm13MEgwcytrClNVcEZPU0xkV0tpRVZtdXFGeVBXS3dlY1J3ZlBLUEV5NDRkVW12cGZsQ3JEbHZBaEhJVGRkMldGajBXc21ITm0KUjlLTW52ZHpia3pOS1lKQmt6ZjBtZmFSYitoS0hyMkE1V05UTFNYRUlRS0JnRzgwZ1pvQlJSMEU1cm5RZWcrYQp5NW43NWZxamQ3dGNBSE1NVVhORzR3c3kyU2I2c055RGJPVVEvandZNFczd2ZXdGlTdkJXdTB6SEVEOHVoWTZVCkZ6SU51c0hnNmhCa2NzMEV3cFJpeXNyc1ZEaktaNjNhdnkyU0xzVW41T2N1dU1wd3QyenlLRHgxS2NsbSs4NTQKRXZuK2dTQzh0Y1lCcEV3dE1qZUIxclQ3Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"
CONVEX_AUTH_PUBLIC_KEY="LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFzZVJidHFBWTVxL2pYVTZSbmpoOApGSCsvUy9YTFhRRjN1blRSQ0tjWmRMejNFaVJMeklrN0g1L2hCdVRYNEt4K2I1R2I1VldPdXp3eFl0WmEyMktCCnE0M3ByL24xNWFUOEtxQXBpbUJoSGgycHJwUjJGM2FYc3F4NjZINjU2NVpLRCtNNFlKMDc5aEQwYjhIdS9BTUcKUnUzazBIdWVWbi9Rb0dZSXUvbnRKeG0veDFDc00zcCtka2NBTWZNSFdqTEhpakxrYjZFaHVPQUpoWjRZdzFrWApWZmhwdjFKSGZCYUVoNVd6Sy81a2xPTzBHazhHZ0YxdzI3TGxBTlpEeFhKeUFUYzN3cGV3eWJmaWE0OUJMdGRpCkJNOWtZQVV6Ty8rSSthNitZT2QvZncxcG9QYXRjRGI1T21sWE9BQkdUaVIvWlNJR2FSblFCbCtCRTJxOXhnL0sKcFFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg=="
NEXT_PUBLIC_APP_URL=http://localhost:3000

# for deploying
CONVEX_DEPLOY_KEY=dev:dependable-butterfly-811|eyJ2MiI6IjQyY2IxYWMwMWJmOTQ0YTg4Y2ZmYjcwMjhlODEyYThmIn0=

# WorkOS AuthKit
WORKOS_API_KEY=sk_...dHI
WORKOS_CLIENT_ID=client_01KV3J2M42HT3P59CBKMQMZ998
WORKOS_COOKIE_PASSWORD=pfJ...yUU+Ki+18sFk5nuBgOFVPq+TIUtq2FXpyauAo=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback

Add all these features listed : 
- Possibility to choose personnalised colour for calendar events
- Better overall personnalisation of the experience, colours, layout, feeling.
- QOL improvements you could find useful, improvements in speed/intuitivenss, functionalities. 
- Ensure the app is better, feels better and is better usable, mobile first. 
- At the bottom right, I want the two bubbles (for chat and AI) to be stacked up, and when user hovers the two bubbles it slides to be revelead and allows user to click on the chosen bubble (ensure clean animations, sleek little aestehtic animations for the bubbles and windows. Improve also the modals and popups for ai and chat to be better and working together, allowing to also make panels etc... 
- Make the whole app more modular, cleaner to use, no issues, intuitive and clean, so that users who are not well at ease with tech can still use it. 
- Improve intuitiveness of the document page (with the top bar) to make it cleaner, when users hover the ivons it reveal the title of what it is (like Add to favorite, etc...), all well. Pages that are selected as public (with public link) should be editable by guests without accounts, in live like google docs. 
Make sure to check out everything efficiently and see what you can improve, you have low credits though, so optimise as much as you can, ask for what you need to optimise etc... Be accurate ! 

Think of pushing to github regularly to main with the user I gave you at top, no sub-repo, clean repo you use only what you have cloned and not your base workspace. 


Improve windows, add the little function showing in the top of th docuemnts page when hovering, cleanly and intuitive, improve windows and modals handling and showing for Ui and UX for version history, etc...
Cleaner and sleeker, better handled and more intuitive. 


Add two icons (A2E x Learnmed l Syna_1.png) for white theme and (A2E x Learnmed l Syna_2.png) for dark theme, for the AI logo on the bottom right and for the icon to replace the three dots at bottom roght (before opening the menu on hover) : 
![alt text](<A2E x Learnmed l Logo texxel_1.png>) for dark theme
![alt text](<A2E x Learnmed l Logo texxel_2.png>) for white theme
Also, the textbox made for blocknote (background for it) is not the colour I gave you : White colour : FAF6F2

Black colour : 31302E
Make sure it applies well to the background of the blocknote backgrounds (text boxes for instance), cleanly.