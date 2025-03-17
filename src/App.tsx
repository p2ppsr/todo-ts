/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * src/App.tsx
 *
 * This file contains the primary business logic and UI code for the ToDo
 * application.
 */
import React, { useState, useEffect, type FormEvent } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import {
  AppBar, Toolbar, List, ListItem, ListItemText, ListItemIcon, Checkbox, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
  Button, Fab, LinearProgress, Typography, IconButton, Grid
} from '@mui/material'
import { styled } from '@mui/system'
import AddIcon from '@mui/icons-material/Add'
import GitHubIcon from '@mui/icons-material/GitHub'
import useAsyncEffect from 'use-async-effect'
import NoMncModal from './components/NoMncModal/NoMncModal'
import { WalletClient, PushDrop, Utils, Transaction, LockingScript, type WalletOutput, Beef, TransactionOutput, BeefTx } from '@bsv/sdk'
import checkForMetaNetClient from './utils/checkForMetaNetClient'
import { type Task } from './types/types'
// This stylesheet also uses this for themeing.
import './App.scss'
import { Services } from '@bsv/wallet-toolbox-client'

// This is the namespace address for the ToDo protocol
// You can create your own Bitcoin address to use, and customize this protocol
// for your own needs.
const TODO_PROTO_ADDR = '1ToDoDtKreEzbHYKFjmoBuduFmSXXUGZG'

// These are some basic styling rules for the React application.
// We are using MUI (https://mui.com) for all of our UI components (i.e. buttons and dialogs etc.).
const AppBarPlaceholder = styled('div')({
  height: '4em'
})

const NoItems = styled(Grid)({
  margin: 'auto',
  textAlign: 'center',
  marginTop: '5em'
})

const AddMoreFab = styled(Fab)({
  position: 'fixed',
  right: '1em',
  bottom: '1em',
  zIndex: 10
})

const LoadingBar = styled(LinearProgress)({
  margin: '1em'
})

const GitHubIconStyle = styled(IconButton)({
  color: '#ffffff'
})

const walletClient = new WalletClient()

const App: React.FC = () => {
  // These are some state variables that control the app's interface.
  const [isMncMissing, setIsMncMissing] = useState<boolean>(false)
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createTask, setCreateTask] = useState<string>('')
  const [createAmount, setCreateAmount] = useState<number>(1000)
  const [createLoading, setCreateLoading] = useState<boolean>(false)
  const [tasksLoading, setTasksLoading] = useState<boolean>(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [completeOpen, setCompleteOpen] = useState<boolean>(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [completeLoading, setCompleteLoading] = useState<boolean>(false)

  // Run a 1s interval for checking if MNC is running
  useAsyncEffect(() => {
    const intervalId = setInterval(() => {
      checkForMetaNetClient().then(hasMNC => {
        if (hasMNC === 0) {
          setIsMncMissing(true) // Open modal if MNC is not found
        } else {
          setIsMncMissing(false) // Ensure modal is closed if MNC is found
          clearInterval(intervalId)
        }
      }).catch(error => {
        console.error('Error checking for MetaNet Client:', error)
      })
    }, 1000)

    // Return a cleanup function
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Creates a new ToDo token.
  // This function will run when the user clicks "OK" in the creation dialog.
  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault() // Stop the HTML form from reloading the page.
    try {
      // Here, we handle some basic mistakes the user might have made.
      if (createTask === '') {
        toast.error('Enter a task to complete!')
        return
      }
      if (createAmount === 0 || isNaN(createAmount)) {
        toast.error('Enter an amount for the new task!')
        return
      }
      if (createAmount < 1) {
        toast.error('The amount must be more than 1 satoshis!')
        return
      }

      // Now, we start a loading bar before the encryption and heavy lifting.
      setCreateLoading(true)

      // We can take the user's input from the text field (their new task), and
      // encrypt it with a key that only they have. When we put the encrypted
      // value into a ToDo Bitcoin token, only the same user can get it back
      // later on, after creation.
      const encryptedTask = (await walletClient.encrypt({
        // The plaintext for encryption is what the user put into the text field.
        // encrypt() expects an array of numbers. The BSV provides toArray(), a utility function that creates a number array from a string.
        plaintext: Utils.toArray(createTask, 'utf8'),
        // The protocolID and keyID are important. When users encrypt things, they can do so in different contexts. The protocolID is the "context" in which a user has encrypted something. When your app uses a new protocol, it can only do so with the permission of the user.
        protocolID: [0, 'todo list'],
        // The keyID can be used to enable multiple keys for different
        // operations within the same protocol.For our simple "todo list"
        // protocol, let's all just agree that the keyID should be "1".
        keyID: '1'
        // P.S. We'll need to use the exact same protocolID and keyID later,
        // when we want to decrypt the ToDo list items.Otherwise, the
        // decryption would fail.
      })).ciphertext

      // Here's the part where we create the new Bitcoin token.
      // This uses a library called PushDrop, which lets you attach data
      // payloads to Bitcoin token outputs.Then, you can redeem / unlock the
      // tokens later.
      const pushdrop = new PushDrop(walletClient)
      const bitcoinOutputScript = await pushdrop.lock(
        [ // The "fields" are the data payload to attach to the token.
          // For more info on these fields, look at the ToDo protocol document
          // (PROTOCOL.md). Note that the PushDrop library handles the public
          // key, signature, and OP_DROP fields automatically.
          Utils.toArray(TODO_PROTO_ADDR, 'utf8') as number[], // TODO protocol namespace address TODOMATT remove the as number[] after updated sdk
          encryptedTask // TODO task (encrypted)
        ],
        // The same "todo list" protocol and key ID can be used to sign and
        // lock this new Bitcoin PushDrop token.
        [0, 'todo list'],
        '1',
        'self'
      )

      // Now that we have the output script for our ToDo Bitcoin token, we can
      // add it to a Bitcoin transaction (a.k.a. "Action"), and register the
      // new token with the blockchain. On the MetaNet, Actions are anything
      // that a user does, and all Actions take the form of Bitcoin
      // transactions.
      const newToDoToken = await walletClient.createAction({
        // This Bitcoin transaction ("Action" with a capital A) has one output,
        // because it has led to the creation of a new Bitcoin token. The token
        // that gets created represents our new ToDo list item.
        outputs: [{
          // The output script for this token was created by PushDrop library,
          // which you can see above.
          lockingScript: bitcoinOutputScript.toHex(),
          // The output amount is how much Bitcoin (measured in "satoshis")
          // this token is worth. We use the value that the user entered in the
          // dialog box.
          satoshis: Number(createAmount),
          // We can put the new output into a "basket" which will keep track of
          // it, so that we can get it back later.
          basket: 'todo tokens',
          // Lastly, we should describe this output for the user.
          outputDescription: 'New ToDo list item'
        }],
        options: {
          randomizeOutputs: false,
          acceptDelayedBroadcast: false
        },
        // Describe the Actions that your app facilitates, in the present
        // tense, for the user's future reference.
        description: `Create a TODO task: ${createTask}`
      })

      // if (newToDoToken.log != null && newToDoToken.log !== '') { // TODOMATT what should i do about logging here?
      //   console.log(stampLogFormat(newToDoToken.log))
      // }

      // Now, we just let the user know the good news! Their token has been
      // created, and added to the list.
      toast.dark('Task successfully created!')
      setTasks([
        {
          task: createTask,
          sats: Number(createAmount),
          outpoint: `${newToDoToken.txid}.0`,
          lockingScript: bitcoinOutputScript.toHex(),
          beef: newToDoToken.tx
        },
        ...tasks
      ])
      setCreateTask('')
      setCreateAmount(1000)
      setCreateOpen(false)
    } catch (e) {
      // Any errors are shown on the screen and printed in the developer console
      toast.error((e as Error).message)
      console.error(e)
    } finally {
      setCreateLoading(false)
    }
  }

  // Redeems the ToDo token, marking the selected task as completed.
  // This function runs when the user clicks the "complete" button on the
  // completion dialog.
  const handleCompleteSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault() // Stop the HTML form from reloading the page.
    try {
      // Start a loading bar to let the user know we're working on it.
      setCompleteLoading(true)

      if (selectedTask === null) {
        throw new Error('selectedTask does not exist')
      }

      // Let the user know what's going on, and why they're getting some
      // Bitcoins back.
      let description = `Complete a TODO task: "${selectedTask.task}"`
      if (description.length > 128) { description = description.substring(0, 128) }

      // const inputBeef = new Beef()
      // inputBeef.mergeBeef(selectedTask.beef as number[])

      const txid = selectedTask.outpoint.split('.')[0]
      // const loadedBeef = Beef.fromBinary(selectedTask.beef as number[])
      // const isValid = loadedBeef.isValid()
      // if (!isValid) {
      //   console.log(loadedBeef.toLogString())
      //   throw new Error('The existing BEEF for this task is not valid!')
      // }

      // If you want an atomic BEEF that includes the final TX `txid` plus its ancestors:
      // const atomicBEEF = loadedBeef.toBinaryAtomic(txid)
      const loadedBeef = Beef.fromBinary(selectedTask.beef as number[])
      const ok = await loadedBeef.verify(await new Services('main').getChainTracker(), true)
      // const txTest = Transaction.fromBEEF(selectedTask.beef as number[], txid)
      const { signableTransaction } = await walletClient.createAction({
        description,
        // These are inputs, which unlock Bitcoin tokens.
        // The input comes from the previous ToDo token, which we're now
        // completing, redeeming and spending.
        inputBEEF: loadedBeef.toBinary(),
        inputs: [{
          // Spending descriptions tell the user why this input was redeemed
          inputDescription: 'Complete a ToDo list item',
          // The output we want to redeem is specified here
          outpoint: selectedTask.outpoint,
          // Provide a placeholder length for the unlocking script we will create and add later
          unlockingScriptLength: 73
        }],
        options: {
          randomizeOutputs: false
        }
      })

      if (signableTransaction === undefined) {
        throw new Error('Failed to create signable transaction')
      }
      const partialTx = Transaction.fromBEEF(signableTransaction.tx)

      // Here, we're using the PushDrop library to unlcok / redeem the PushDrop
      // token that was previously created. By providing this information,
      // PushDrop can "unlock" and spend the token. When the token gets spent,
      // the user gets their bitcoins back, and the ToDo token is removed from
      // the list.
      const unlocker = new PushDrop(walletClient).unlock(
        // To unlock the token, we need to use the same "todo list" protocolID
        // and keyID as when we created the ToDo token before. Otherwise, the
        // key won't fit the lock and the Bitcoins won't come out.
        [0, 'todo list'],
        '1',
        'self',
        'all',
        false,
        // the amount of Bitcoins we are expecting to unlock when the puzzle gets solved.
        selectedTask.sats,
        // We also give PushDrop a copy of the locking puzzle ("script") that
        // we want to open, which is helpful in preparing to unlock it.
        LockingScript.fromHex(selectedTask.lockingScript)
      )

      const unlockingScript = await unlocker.sign(partialTx, 0)

      // Now, we're going to use the unlocking puzle that PushDrop has prepared
      // for us, so that the user can get their Bitcoins back.This is another
      // "Action", which is just a Bitcoin transaction. TODOMATT rewrite this section's comments
      const signResult = await walletClient.signAction({
        reference: signableTransaction.reference,
        spends: {
          0: {
            unlockingScript: unlockingScript.toHex()
          }
        }
      })
      console.log(signResult)

      // if (r.log != null && r.log !== '') { TODOMATT logging here and 2 lines up?
      //   console.log(stampLogFormat(r.log))
      // }

      // Finally, we let the user know about the good news, and that their
      // completed ToDo token has been removed from their list! The satoshis
      // have now been unlocked, and are back in their posession.
      toast.dark('Congrats! Task complete 🎉')
      setTasks((oldTasks) => {
        const index = oldTasks.findIndex(x => x === selectedTask)
        if (index > -1) oldTasks.splice(index, 1)
        return [...oldTasks]
      })
      setSelectedTask(null)
      setCompleteOpen(false)
    } catch (e) {
      toast.error(`Error completing task: ${(e as Error).message}`)
      console.error(e)
    } finally {
      setCompleteLoading(false)
    }
  }

  // This loads a user's existing ToDo tokens from their token basket
  // whenever the page loads. This populates their ToDo list.
  // A basket is just a way to keep track of different kinds of Bitcoin tokens.
  useEffect(() => {
    void (async () => {
      try {
        // We use a function called "listOutputs" to fetch this
        // user's current ToDo tokens from their basket. Tokens are just a way
        // to represent something of value, like a task that needs to be
        // completed.
        // This function will only get tokens that are active on the list, not already complete TODOMATT CHECK THIS
        const tasksFromBasket = await walletClient.listOutputs({
          // The name of the basket where the tokens are kept
          basket: 'todo tokens',
          // Also get the envelope needed if we complete (spend) the ToDo token
          include: 'entire transactions'
        })
        // Now that we have the data (in the tasksFromBasket variable), we will
        // decode and decrypt the tasks we got from the basket.When the tasks
        // were created, they were encrypted so that only this user could read
        // them.Here, the encryption process is reversed.
        let txid: string
        const decryptedTasksResults = await Promise.all(tasksFromBasket.outputs.map(async (task: WalletOutput, i: number) => {
          try {
            txid = tasksFromBasket.outputs[i].outpoint.split('.')[0]
            const tx = Transaction.fromBEEF(tasksFromBasket.BEEF as number[], task.outpoint.split('.')[0])
            const lockingScript = tx!.outputs[0].lockingScript

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            // const lockingScript = parsedTx.outputs[i].lockingScript
            const decodedTask = PushDrop.decode(lockingScript)
            const encryptedTask = decodedTask.fields[1]
            const decryptedTaskNumArray =
              await walletClient.decrypt({
                ciphertext: encryptedTask,
                protocolID: [0, 'todo list'],
                keyID: '1'
              })
            const decryptedTask = Utils.toUTF8(decryptedTaskNumArray.plaintext)

            return {
              lockingScript: lockingScript.toHex(),
              outpoint: `${txid}.${i}`,
              sats: task.satoshis ?? 0,
              task: decryptedTask,
              beef: tasksFromBasket.BEEF
            }
          } catch (error) {
            console.error('Error decrypting task:', error)
            return null
          }
        }))

        // Filter out outputs that returned null (i.e. errors)
        const decryptedTasks: Task[] = decryptedTasksResults.filter(
          (result): result is Task => result !== null
        )


        // We reverse the list, so the newest tasks show up at the top
        setTasks(decryptedTasks.reverse())
      } catch (e) {
        // Any larger errors are also handled. If these steps fail, maybe the
        // user didn't give our app the right permissions, and we couldn't use
        // the "todo list" protocol.

        // Check if the error code is related to missing MNC and supress.
        // MNC is being polled until it is launched so no error message is required.
        const errorCode = (e as any).code
        if (errorCode !== 'ERR_NO_METANET_IDENTITY') {
          toast.error(`Failed to load ToDo tasks! Error: ${(e as Error).message}`)
          console.error(e)
        }
      } finally {
        setTasksLoading(false)
      }
    })()
  }, [])

  // The rest of this file just contains some UI code. All the juicy
  // Bitcoin - related stuff is above.

  // ----------

  // Opens the completion dialog for the selected task
  const openCompleteModal = (task: Task) => () => {
    setSelectedTask(task)
    setCompleteOpen(true)
  }

  return (
    <>
      <NoMncModal open={isMncMissing} onClose={() => { setIsMncMissing(false) }} />
      <ToastContainer
        position='top-right'
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <AppBar position='static'>
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            ToDo List — Get Rewarded!
          </Typography>
          <GitHubIconStyle onClick={() => window.open('https://github.com/p2ppsr/todo-react', '_blank')}>
            <GitHubIcon />
          </GitHubIconStyle>
        </Toolbar>
      </AppBar>
      <AppBarPlaceholder />

      {tasks.length >= 1 && (
        <AddMoreFab color='primary' onClick={() => { setCreateOpen(true) }}>
          <AddIcon />
        </AddMoreFab>
      )}

      {tasksLoading
        ? (<LoadingBar />)
        : (
          <List>
            {tasks.length === 0 && (
              <NoItems container direction='column' justifyContent='center' alignItems='center'>
                <Grid item justifyContent="center" alignItems="center">
                  <Typography variant='h4'>No ToDo Items</Typography>
                  <Typography color='textSecondary'>
                    Use the button below to start a task
                  </Typography>
                </Grid>
                <Grid item justifyContent="center" alignItems="center" sx={{ paddingTop: '2.5em', marginBottom: '1em' }}>
                  <Fab color='primary' onClick={() => { setCreateOpen(true) }}>
                    <AddIcon />
                  </Fab>
                </Grid>
              </NoItems>
            )}
            {tasks.map((x, i) => (
              <ListItem key={i} button onClick={openCompleteModal(x)}>
                <ListItemIcon><Checkbox checked={false} /></ListItemIcon>
                <ListItemText primary={x.task} secondary={`${x.sats} satoshis`} />
              </ListItem>
            ))}
          </List>
        )
      }

      <Dialog open={createOpen} onClose={() => { setCreateOpen(false) }}>
        <form onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              await handleCreateSubmit(e)
            } catch (error) {
              console.error('Error in form submission:', error)
            }
          })()
        }}>
          <DialogTitle>Create a Task</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              Describe your task and set aside some satoshis you&apos;ll get back once it&apos;s done.
            </DialogContentText>
            <TextField
              multiline rows={3} fullWidth autoFocus
              label='Task to complete'
              onChange={(e: { target: { value: React.SetStateAction<string> } }) => { setCreateTask(e.target.value) }}
              value={createTask}
            />
            <br /><br />
            <TextField
              fullWidth
              type='number'
              inputProps={{ min: 1 }}
              label='Completion amount'
              onChange={(e: { target: { value: any } }) => { setCreateAmount(Number(e.target.value)) }}
              value={createAmount}
            />
          </DialogContent>
          {createLoading
            ? (<LoadingBar />)
            : (
              <DialogActions>
                <Button onClick={() => { setCreateOpen(false) }}>Cancel</Button>
                <Button type='submit'>OK</Button>
              </DialogActions>
            )
          }
        </form>
      </Dialog>

      <Dialog open={completeOpen} onClose={() => { setCompleteOpen(false) }}>
        <form onSubmit={(e) => {
          e.preventDefault()
          void (async () => {
            try {
              await handleCompleteSubmit(e)
            } catch (error) {
              console.error('Error in form submission:', error)
            }
          })()
        }}>
          <DialogTitle>Complete &quot;{selectedTask?.task}&quot;?</DialogTitle>
          <DialogContent>
            <DialogContentText paragraph>
              By marking this task as complete, you&apos;ll receive back your {selectedTask?.sats} satoshis.
            </DialogContentText>
          </DialogContent>
          {completeLoading
            ? (<LoadingBar />)
            : (
              <DialogActions>
                <Button onClick={() => { setCompleteOpen(false) }}>Cancel</Button>
                <Button type='submit'>Complete Task</Button>
              </DialogActions>
            )
          }
        </form>
      </Dialog>
    </>
  )
}

export default App
