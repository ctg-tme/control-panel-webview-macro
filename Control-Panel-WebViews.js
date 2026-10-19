/********************************************************
Copyright (c) 2026 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
*********************************************************x

 * Author(s)                Robert(Bobby) McGonigle
 *                          Technical Marketing Engineering, Technical Leader
 *                          Cisco Systems
 * 
 * Description: 
 *  - Easily manage and open Webviews on RoomOS or MTR Devices via Control Panel UI Extensions
 * 
 * NOTE: 2 UI Extension Panels are loaded onto the endpoint
 *       One of which is hidden, this allows us to control which page is open when the visible panel is clicked
*/

import xapi from 'xapi';

const config = {
  UserInterface: {
    Panel: {
      Name: 'Web Content',        // AcceptedValues: String || Configure the Name of the Quick Docs Panel
      Color: '008000',            // AcceptedValues: String || Configure the Color of the Quick Docs Panel with a hexadecimal color code
      Icon: 'Language'            // AcceptedValues: String || Configure the Icon of the Quick Docs Panel
    },
    AutoClose: true               // AcceptedValues: Boolean|| Automatically close the UI Extension Panel when a WebView is opened
  }
};

const Site_List = [
  /*
  Schema
  {
    Name: '',                     // AcceptedValues: String || Set the user facing name of the Webview's Widget
    URL: '',                      // AcceptedValues: String || Set the URL of the Webview
    Category: ''                  // AcceptedValues: String || Set a Category for this Webview, if none provided, the page will end up under a General Category
  }
  */
  {
    Name: 'Cisco',
    URL: 'https://cisco.com',
    Category: ''
  },
  {
    Name: 'RoomOS xAPI',
    URL: 'https://roomos.cisco.com',
    Category: 'Developers'
  }
];

// Used to help encode/decode URL components contained within the UI Extension XML
let decodeMethod = 'atob';

const transcodeMethod = {
  btoa: (str) => btoa(str),
  atob: (str) => atob(str),
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent
};

let pageList = [];


// Builds the UserInterface based on the Provided Config and Site List information
async function buildUI(attempt = 0, encodeMethod = 'btoa') {
  console.log({ Message: 'Building UserInterface', UrlEncodingMethod: encodeMethod });
  let logList = [];

  // Set the method to decode the URL within the XML, this is mainly to handle strange characters in URLs
  switch (encodeMethod) {
    case 'btoa':
      decodeMethod = 'atob';
      break;
    case 'encodeURIComponent':
      decodeMethod = 'decodeURIComponent';
      break;
  };

  // Discover, filter and sort all categories defined
  Site_List.forEach((element, index) => {
    if (element.Category == '') {
      Site_List[index].Category = 'General';
    };
    pageList.push(element.Category);
  });
  pageList = [...new Set(pageList)];
  pageList = pageList.sort((a, b) => {
    if (a === 'General') {
      return -1; // Move 'General' to the beginning
    } else if (b === 'General') {
      return 1; // Move 'General' to the beginning
    } else {
      return a.localeCompare(b); // Sort alphabetically
    };
  });

  console.info({ Info: `Page Categories discovered`, Categories: pageList.toString().replace(/,/gm, ', ') });

  let pages = {};

  pageList.forEach(element => { pages[element] = {}; pages[element].buttonXML = `` });

  //Build the Widgets for Each Page
  pageList.forEach(element => {
    Site_List.forEach(el => {
      if (element == el.Category) {
        console.debug({ Debug: `Adding [${el.Name}] to [${el.Category}] page`, Url: el.URL });
        logList.push(el.Name);
        pages[element].buttonXML = pages[element].buttonXML + `<Row>
          <Widget>
            <WidgetId>cpw~url~${transcodeMethod[encodeMethod](el.URL)}~${el.Name}</WidgetId>
            <Name>${el.Name}</Name>
            <Type>Button</Type>
            <Options>size=4</Options>
          </Widget>
          </Row>`;
      };
    });

    // Wraps the buttons for each page within the target page
    pages[element].pageXML = `<Page>
      <Name>${element}</Name>
        ${pages[element].buttonXML}
      <PageId>cpw~${element}</PageId>
      <Options>hideRowNames=1</Options>
    </Page>`;
  });

  let allPages = ``;

  pageList.forEach(element => {
    allPages = allPages + pages[element].pageXML;
  });

  console.log({ Message: `[${Site_List.length}] WebViews sites configured across [${pageList.length}] pages`, SiteNames: logList.toString().replace(/,/gm, ', ') });

  let hiddenXML = `<Extensions>
        <Panel>
          <PanelId>cpw~panel</PanelId>
          <Location>Hidden</Location>
          <Icon>${config.UserInterface.Panel.Icon}</Icon>
          <Name>${config.UserInterface.Panel.Name} (Hidden)</Name>
          <Color>#${config.UserInterface.Panel.Color}</Color>
          <ActivityType>Custom</ActivityType>
          ${allPages}
          <Page>
            <Name>Close ❌</Name>
            <PageId>cpw~#closeWebview</PageId>
            <Options>hideRowNames=1</Options>
          </Page>
        </Panel>
      </Extensions>`;

  let visibleXML = `<Extensions>
      <Panel>
        <Location>ControlPanel</Location>
        <Icon>${config.UserInterface.Panel.Icon}</Icon>
        <Name>${config.UserInterface.Panel.Name}</Name>
        <Color>#${config.UserInterface.Panel.Color}</Color>
        <ActivityType>Custom</ActivityType>
      </Panel>
    </Extensions>`;

  try {
    await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'cpw~hidden' }, hiddenXML);
    await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'cpw~visible' }, visibleXML);
    console.log({ Message: 'UserInterface Built!' });
  } catch (e) {
    if (attempt < 1) {
      console.warn({ Warn: `Failed parsing XML, replacing B64 Encoding with EncodeURIComponent in an attempt to fix` });
      try {
        await buildUI(1, 'encodeURIComponent');
      } catch (err) {
        err.Context = '1 or More URLs provided may contain characters not suitable for XML, please review and test';
        throw Error(err);
      };
    } else {
      throw Error(e);
    };
  };
};

// Starts subscriptions defined in the Subscribe Object
async function StartSubscriptions() {
  const subs = Object.getOwnPropertyNames(Subscribe);
  subs.sort();
  let mySubscriptions = [];
  subs.forEach(element => {
    Subscribe[element]();
    mySubscriptions.push(element);
    Subscribe[element] = function () {
      console.warn({ Warn: `The [${element}] subscription is already active, unable to fire it again` });
    };
  });
  console.info({ Info: 'Subscriptions Set', Details: { Total_Subs: subs.length, Active_Subs: mySubscriptions.join(', ') } });
};

// xAPI Subscription Definitions
const Subscribe = {
  WidgetActions: function () {
    xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
      if (event.Type == 'released' && event.WidgetId.includes('cpw~url~')) {
        const [app, type, url, name] = event.WidgetId.split('~');
        console.log({ Message: `Opening [${name}] WebView`, Url: transcodeMethod[decodeMethod](url) });
        xapi.Command.UserInterface.WebView.Display({ Url: transcodeMethod[decodeMethod](url), Title: name });
        if (config.UserInterface.AutoClose) {
          console.debug({ Debug: 'AutoClosing Webview Panel Extension' });
          xapi.Command.UserInterface.Extensions.Panel.Close();
        };
      };
    });
  },
  PanelClicked: function () {
    xapi.Event.UserInterface.Extensions.Panel.Clicked.on(event => {
      if (event.PanelId == 'cpw~visible') {
        xapi.Command.UserInterface.Extensions.Panel.Open({ PanelId: 'cpw~hidden', PageId: `cpw~${pageList[0]}` });
        console.debug({ Debug: `cpw~hidden panel opened on page [${pageList[0]}]` });
      };
    });
  },
  PageOpened: function () {
    xapi.Event.UserInterface.Extensions.Event.PageOpened.on(event => {
      if (event.PageId == 'cpw~#closeWebview') {
        console.debug({ Debug: `Closing Webview`, Cause: 'Close ❌ page opened by user' });
        xapi.Command.UserInterface.WebView.Clear();
        xapi.Command.UserInterface.Extensions.Panel.Open({ PanelId: 'cpw~hidden', PageId: `cpw~${pageList[0]}` });
      };
    });
  }
};



async function init() {
  console.info({ Info: `Initializing Macro...` });

  await buildUI();

  await StartSubscriptions();

  console.info({ Info: `Macro Initialized and Ready!` });
  console.warn(`- - - - - - - - - - - - - - - - - - -`);
};

init();
