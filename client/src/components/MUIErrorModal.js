import { useContext } from 'react'
import Modal from '@mui/material/Modal';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import AuthContext from '../auth'

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    height: 200,
    width: 400,
    border: '5px solid yellow',
    fontSize: "20px",
    p: 4
};


export default function MUIErrorModal() {
    const { auth } = useContext(AuthContext)

    function handleCloseButton() {
        auth.clearError();
    }

    return (
        <Modal open = {auth.errorMessage !== null}>
         <Alert sx={style} severity="warning">{auth.errorMessage}
         <Button sx={{color:"black", mt:"20px", ml:"85px", fontSize: 13, fontWeight: 'bold', border: 2}}variant="outlined" onClick={handleCloseButton}>Close</Button>
         </Alert>
        </Modal>
    );
}
