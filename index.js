const fs = require('fs');
const readline = require('readline');

const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
})

const tables = [];

const database_column_types = {
    VarChar: 'varchar',
    NVarChar: 'nvarchar',
    TinyInt: 'tinyint',
    Int: 'int',
    Char: 'char',
    Money: 'numeric',
    DateTime: 'datetime',
    Date: 'date',
    SmallInt: 'smallint'
}

const javascript_column_types = {
    VarChar: 'string',
    NVarChar: 'string',
    TinyInt: 'number',
    Int: 'number',
    Char: 'string',
    Money: 'number',
    DateTime: 'Date',
    Date: 'Date',
    SmallInt: 'number'
}

try {
    const schema = fs.readFileSync('./schema.prisma', 'utf-8');

    const models = schema.split('model ');

    models.shift();

    const table_rubbish = [
        '',
        '/// The underlying table does not contain a valid unique identifier and can therefore currently not be handled by the Prisma Client.',
        '}',
        '@@ignore',
    ]

    for (let i = 0; i < 100; i++)
    {
        const [table_name, table_content] = models[i].split(' {');
        const table_lines = table_content.split('\r\n');
        const raw_table_columns = table_lines.filter((line) => {
            if (table_rubbish.includes(line.trim()))
            {
                return false;
            }
            if (line.trim().slice(0, 7) == '@@index')
            {
                return false;
            }
            return true;
        });
        const table_columns = raw_table_columns.map((column) => column.trim());
        const table_columns_types = table_columns.map((column) => {
            const space_char_index = column.indexOf(' ');
            const raw_row_name = column.slice(0, space_char_index);
            const row_name = raw_row_name.trim();
            const raw_row_type = column.slice(space_char_index);
            const row_type = raw_row_type.trim();

            const type_before_notation = row_type.indexOf(' ');
            
            let nullable = false;
            let notation = '';
            let db_type = '';
            let js_type = '';

            if (type_before_notation < 0)
            {
                if (row_type.slice(-1) == '?')
                {
                    nullable = true;
                    notation = row_type.substring(0, row_type.length - 1);
                }
                else
                {
                    notation = row_type;
                }

               db_type = database_column_types[notation];
               js_type = javascript_column_types[notation];
            }
            else
            {
               const row_data_type = row_type.slice(0, type_before_notation);

               if (row_data_type.slice(-1) == '?')
               {
                    nullable = true;
               }

               let row_notation = row_type.slice(type_before_notation).trim();
                
               if (row_notation.slice(0, 8) != '@default')
               {
                    let row_notation_value = null;
                    const row_notation_value_index_start = row_notation.indexOf('(');

                    if (row_notation_value_index_start > 0)
                    {
                        const row_notation_value_index_end = row_notation.indexOf(')');
                        row_notation_value =
                        row_notation.slice(row_notation_value_index_end, row_notation_value_index_end);

                        row_notation = row_notation.slice(0, row_notation_value_index_start);
                    }

                    row_notation_type = row_notation.slice(4);

                   db_type = database_column_types[row_notation_type];
                   js_type = javascript_column_types[row_notation_type];
               }
            }

            return { row_name, nullable, db_type, js_type };
        });

        const table = {
            table_name,
            table_rows: table_columns_types,
        };

        tables.push(table);
    }
} catch (error) {
    
}

var i = 0;
if (i == 0)
{
    console.log(`initial print ${tables[i].table_name}`);
}

reader.prompt();

reader.on('line', (input) => {
    console.log(i);
    const table = tables[i];
    i += 1;
    
    const { table_name, table_rows } = table;


    if (fs.existsSync(`./entities/${input}.entity.ts`))
    {
        fs.unlinkSync(`./entities/${input}.entity.ts`)
    }

    const imports = 
    `import {
        Column,
        Entity,
        PrimaryGeneratedColumn,
      } from 'typeorm';
      
      `;

    const entity = 
    `@Entity({ name: '${table_name}' })
    `;

    const class_export = `export class ${table_name} {
        `;

    const first_row = table_rows.shift();

    const first_column =
    `@PrimaryGeneratedColumn()
      ${first_row.row_name}: number;
    `;

    let columns = '';

    for (const row of table_rows)
    {
        const { row_name, nullable, db_type, js_type } = row;

        const column = 
        `
        @Column({
            name: '${row_name}',
            nullable: ${nullable},
            type: '${db_type}',
        })
          ${row_name}: ${js_type}

        `;

        columns = columns + column;
    }

    const entity_file = imports + entity + class_export + first_column + columns + `
}`;

    fs.writeFileSync(`./entities/${input}.entity.ts`, entity_file);

    if (fs.existsSync(`./implementation/${input}.entity.ts`))
    {
        fs.unlinkSync(`./implementation/${input}.entity.ts`)
    }

    const implementation_imports = `
    import { Inject, Injectable } from '@nestjs/common';
    import { MSSQL_REPOSITORIES } from 'src/shared/constants/orm';
    import { FindOptionsWhere, Repository } from 'typeorm';
    import { ${table_name} } from '../entities/${input}.entity';`;

    const class_name = input.charAt(0).toUpperCase() + input.slice(1);

    console.log(class_name);

    const implementation_class =
    `
    @Injectable()
    export class ${class_name}Impl {
      constructor(
        @Inject(MSSQL_REPOSITORIES.${input.toUpperCase()}_REPOSITORY)
        private readonly ${input}Repository: Repository<${table_name}>,
      ) {}
    
      async create(auditorship_data: Partial<${table_name}>): Promise<${table_name}> {
        const ${input} = await this.${input}Repository.save(auditorship_data);
    
        return ${input};
      }
    
      async findOne(
        criteria: FindOptionsWhere<${table_name}> | any,
      ): Promise<${table_name}> {
        const ${input} = await this.${input}Repository.findOne({
          where: criteria,
        });
    
        return ${input};
      }
    
      async find(
        criteria: FindOptionsWhere<${table_name}> | any,
      ): Promise<${table_name}[]> {
        const ${input}s = await this.${input}Repository.find({
          where: criteria,
        });
    
        return ${input}s;
      }
    
      async update(
        criteria: FindOptionsWhere<${table_name}>,
        ${input}_data: Partial<${table_name}>,
      ): Promise<number> {
        const ${input}s = await this.${input}Repository.update(
          criteria,
          ${input}_data,
        );
    
        return ${input}s.affected;
      }
    }
    `

    const implementation = implementation_imports + implementation_class;

    fs.writeFileSync(`./implementation/${input}.entity.ts`, implementation);

    if(tables[i])
    {
        console.log(tables[i].table_name);
    }
});

reader.on('close', (input) => {
    console.log('Shutting down...');
    process.exit(0);
});