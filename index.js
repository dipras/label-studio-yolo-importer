import inquirer from 'inquirer';
import jsYaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

let mainFolder = "";
const execute = async () => {
    if (process.argv[2] === undefined) {
        console.log("Please provide the folder name as an argument.");
        return;
    }
    mainFolder = path.join(process.cwd(), process.argv[2]);
    const filePath = path.join(mainFolder, 'data.yaml');
    const data = jsYaml.load(fs.readFileSync(filePath, 'utf8'));
    const answers = await inquirer.prompt({
        type: 'checkbox',
        name: 'labels',
        message: 'Choose the labels',
        choices: data.names.map((name) => {
            return {
                name: name,
                value: name,
                checked: false,
            };
        }),
        validate(answer) {
            if (answer.length === 0) {
                return 'You must choose at least one label';
            }

            return true;
        },
    });

    fs.writeFileSync(
        path.join(mainFolder, 'classes.txt'),
        data.names.join('\n'),
        'utf8'
    );

    grouping();
    filter(answers.labels.map((name) => data.names.indexOf(name)));

    console.log("✅ Done! Time for exporting");
    exportData();
}

const exportData = () => {
    console.log("✅ Done! Time for exporting");

    const folderName = process.argv[2];

    const command = `source /root/env/bin/activate && label-studio-converter import yolo -i /root/yolo-datasets/${folderName} -o /var/www/html/${folderName}.json --image-root-url '/data/local-files/?d=${folderName}/images'`;

    const proc = Bun.spawnSync(["bash", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
    });

    if (proc.exitCode !== 0) {
        console.error(`❌ Error (exit code ${proc.exitCode}):`);
        console.error(proc.stderr.toString());
    } else {
        console.log(`✅ Success exported!`);
        console.log(proc.stdout.toString());
    }

}

const grouping = () => {

    if (!fs.existsSync(mainFolder)) {
        console.log("Folder tidak ada");
    }

    if (!fs.existsSync(path.join(mainFolder, "images"))) {
        fs.mkdirSync(path.join(mainFolder, "images"));
    }

    if (!fs.existsSync(path.join(mainFolder, "labels"))) {
        fs.mkdirSync(path.join(mainFolder, "labels"));
    }

    ['train', 'valid', 'test'].forEach(fold => {
        ['images', 'labels'].forEach(type => {
            const folderPath = path.join(mainFolder, fold, type);
            const targetPath = path.join(mainFolder, type);
            if (!fs.existsSync(folderPath)) {
                console.log(`Folder ${folderPath} tidak ada`);
                return;
            }
            const files = fs.readdirSync(folderPath);
            files.forEach(name => {
                let targetName = name;
                const oldPath = path.join(folderPath, name);
                const newPath = path.join(targetPath, targetName);
                fs.copyFileSync(oldPath, newPath);
            })
        })
    });
}

const filter = (ids) => {
    const inputFolder = path.join(mainFolder, 'labels/');
    const outputFolder = path.join(mainFolder, 'labels/');
    const imagesFolder = path.join(mainFolder, 'images');

    const allowedIds = new Set(ids);

    // Pastikan folder output ada
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder);
    }

    // Proses semua file di folder input
    fs.readdirSync(inputFolder).forEach(file => {
        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file);
        const imagesPath = path.join(imagesFolder, file.replace(".txt", ".jpg"));
        const idCount = {};

        const data = fs.readFileSync(inputPath, 'utf8');
        const filteredLines = data
            .split('\n')
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;
                const id = parseInt(line.split(' ')[0], 10);
                if (allowedIds.includes(id)) {
                    if (idCount[id] === undefined) {
                        idCount[id] = 0;
                    }

                    if (idCount[id] >= 200) {
                        return false;
                    }
                    idCount[id] += 1;

                    return true;
                } else {
                    return false;
                }
            })

        if (filteredLines.length > 0) {
            fs.writeFileSync(outputPath, filteredLines.join('\n'));
        } else {
            fs.unlinkSync(outputPath);
            fs.unlinkSync(imagesPath);
        }
    });;

}


execute()