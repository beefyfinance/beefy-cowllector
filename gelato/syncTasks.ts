import { syncFantomVaultHarvesterTasks } from "./syncFantomVaultHarvesterTasks";

const run = async () => {
    console.log('>>>>>', 'syncFantomVaultHarvesterTasks()');
    await syncFantomVaultHarvesterTasks();
  };
  
run();