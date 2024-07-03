const fs = require('fs');
const path = require('path');
const markdown = require('markdown-it')();
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);

const template = `
<!DOCTYPE html
	PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">

<head>
	<title>{{title}}</title>
	<style type="text/css" media="screen">
		@import url(../styles/styles.css);
	</style>
	<script src="/config/api.js" type="text/javascript"></script>
</head>

<body>
	<div class="container">
		{{content}}
	</div>
</body>

</html>
`;

async function convertMarkdownToHTML(inputDir, outputDir) {
  try {
    const files = await readdir(inputDir, { withFileTypes: true });

    for (const file of files) {
      const inputFilePath = path.join(inputDir, file.name);
      const outputFilePath = path.join(outputDir, file.name.replace('.md', '.html'));

      if (file.isDirectory()) {
        await mkdir(outputFilePath, { recursive: true });
        await convertMarkdownToHTML(inputFilePath, outputFilePath);
      } else if (file.isFile() && file.name.endsWith('.md')) {
        const data = await readFile(inputFilePath, 'utf8');
        const result = markdown.render(data);
        const title = path.basename(file.name, '.md').replace(/-/g, ' ');
        const htmlContent = template.replace('{{title}}', title).replace('{{content}}', result);
        await writeFile(outputFilePath, htmlContent, 'utf8');
        console.log(`Converted ${inputFilePath} to ${outputFilePath}`);
      }
    }

    // Generate imsmanifest.xml after conversion
    await generateIMSManifest(outputDir);

    // Update index.html after conversion
    await updateIndexHTML(outputDir);

  } catch (error) {
    console.error('Error processing files:', error);
  }
}

async function generateIMSManifest(outputDir) {
  try {
    const files = await readdir(outputDir, { withFileTypes: true });
    let resources = '';

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.html')) {
        const filePath = path.join('resources', file.name);
        resources += `<file href="${filePath}" />\n`;
      } else if (file.isDirectory()) {
        const subDirPath = path.join(outputDir, file.name);
        const subDirFiles = await readdir(subDirPath, { withFileTypes: true });

        for (const subFile of subDirFiles) {
          if (subFile.isFile() && subFile.name.endsWith('.html')) {
            const subFilePath = path.join('resources', file.name, subFile.name);
            resources += `<file href="${subFilePath}" />\n`;
          }
        }
      }
    }

    const manifestContent = `<?xml version="1.0" standalone="no"?>
<manifest identifier="com.scorm.golfsamples.runtime.basicruntime.12" version="1"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="four_geeks_academy_org">
    <organization identifier="four_geeks_academy_org">
      <title>Prompt Engineering Course</title>
      <item identifier="item_1" identifierref="resource">
        <title>Prompt Engineering</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource" type="webcontent" adlcp:scormtype="sco"
      href="config/index.html">
      ${resources}
      <file href="config/index.html" />
      <file href="config/api.js" />
      <file href="resources/styles/styles.css" />
    </resource>
  </resources>
</manifest>`;

    await writeFile(path.join(__dirname, 'imsmanifest.xml'), manifestContent, 'utf8');
    console.log('Generated imsmanifest.xml');
  } catch (error) {
    console.error('Error generating imsmanifest.xml:', error);
  }
}

async function updateIndexHTML(outputDir) {
  try {
    const files = await readdir(outputDir, { withFileTypes: true });
    let pageArray = [];

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.html')) {
        const filePath = path.join('resources', file.name);
        pageArray.push(filePath);
      } else if (file.isDirectory()) {
        const subDirPath = path.join(outputDir, file.name);
        const subDirFiles = await readdir(subDirPath, { withFileTypes: true });

        for (const subFile of subDirFiles) {
          if (subFile.isFile() && subFile.name.endsWith('.html')) {
            const subFilePath = path.join('resources', file.name, subFile.name);
            pageArray.push(subFilePath);
          }
        }
      }
    }

    const indexPath = path.join(__dirname, 'config', 'index.html');
    let indexContent = await readFile(indexPath, 'utf8');

    const pageArrayString = `var pageArray = ${JSON.stringify(pageArray)};`;
    indexContent = indexContent.replace(/var pageArray = .*;/, pageArrayString);

    await writeFile(indexPath, indexContent, 'utf8');
    console.log('Updated index.html with new pageArray');
  } catch (error) {
    console.error('Error updating index.html:', error);
  }
}

const inputPath = process.argv[2];
const outputPath = path.join(__dirname, 'resources');

if (!inputPath) {
  console.error('Please provide the path to the markdown files.');
  process.exit(1);
}

convertMarkdownToHTML(inputPath, outputPath);
