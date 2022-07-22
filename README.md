# Noctua Announcements

This is for Noctua related announcements and 'announcement banner' for the Noctua landing page, Noctua Form Editor and Visual Pathway Editor used to announce, planned outages, updates, new feature documentation, getting started links, etc. This would likely be an effective way of reaching active Noctua users.

## Summary of Displays

### Quick Display

A banner will display a topmost announcement with title, description and external link to more details. A notification bell will display the number of all announcements.
Clicking on the bell will bring a side panel with all announcements
![image](https://user-images.githubusercontent.com/2273929/180366258-36b456c3-e4cf-4055-8474-31f70092788f.png)

### Detailed Display

This will show all the announcements in more detailed with title, description and external link
![image](https://user-images.githubusercontent.com/2273929/180366581-7701c3f7-5ae1-4e65-99ec-50fc9887bda1.png)


## For Announcement Authors

### File Structure

**[notification.json](https://github.com/geneontology/noctua-announcements/blob/dev/notification.json)** is the main file which is read to display the announcements
**[archived-notifications.json](https://github.com/geneontology/noctua-announcements/blob/dev/archived-notifications.json)** for saving recurring pr template notifications
**[docs](https://github.com/geneontology/noctua-announcements/tree/dev/docs)** all the external Markdown files used in more description  
**[docs/updates](https://github.com/geneontology/noctua-announcements/tree/dev/docs/updates)** useful updates after the maintenance window or any changelog  

### Notifications file

The notifications are simply a list on announcements read from top to bottom. The top notification is the only one that appears on the banner, all other appears on the notification panel

#### Each announcement consists of

- **type**: The type of notification (used in the future, i.e. update, announcement, etc) 
- **date**: The date of the notification when it can start appearing (not yet implemented,next version)
- **expiresOn**: The date of the notification expires and no longer show on the announcement list (not yet implemented,next version)
- **level**: The level of importance denoted by color.
  - info: blue background color
  - success: green background color
  - warning: yellow background color
  - danger: red background color
- **title** : title of the notification (be brief)
- **description**: brief description. one or 2 lines
- **descriptionUrl**: url to the extra long notification. it can be google docs, markdown files, wiki, websites etc

### Adding/Removing Announcements

Edit the notification.json file and either PR or if you are admin, you can edit on the fly. Check the example file for format. Please use the format as described above. After updating to GitHub, wait like few seconds or so then the new notifications will be ready.

**Note**

For now Noctua has to manually be refreshed to have new notifications. This is only for prototype